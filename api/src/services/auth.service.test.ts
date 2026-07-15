import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildApp } from '../app'
import type { FastifyInstance } from 'fastify'

// ─── Mocks ─────────────────────────────────────────────────────────────────────

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

// Mock jwks-rsa
vi.mock('jwks-rsa', () => ({
  default: () => ({
    getSigningKey: vi.fn().mockResolvedValue({
      getPublicKey: () => 'mock-public-key',
    }),
  }),
}))

// Mock jsonwebtoken (the external lib used for Cognito token verification)
vi.mock('jsonwebtoken', () => ({
  default: {
    decode: vi.fn(),
    verify: vi.fn(),
  },
}))

import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

// ─── Helpers ───────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-123',
  email: 'john@example.com',
  name: 'John Doe',
  avatarUrl: 'https://example.com/avatar.jpg',
  role: 'ADMIN' as const,
  googleId: 'cognito-sub-123',
  cognitoId: 'cognito-sub-123',
  createdAt: new Date('2026-01-01'),
}

const mockCognitoClaims = {
  sub: 'cognito-sub-123',
  email: 'john@example.com',
  name: 'John Doe',
  picture: 'https://example.com/avatar.jpg',
  'cognito:username': 'google_123456',
  aud: 'test-client-id',
  iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
}

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()

  // Set required env vars
  process.env.AWS_REGION = 'us-east-1'
  process.env.AWS_COGNITO_USER_POOL_ID = 'us-east-1_TestPool'
  process.env.AWS_COGNITO_CLIENT_ID = 'test-client-id'
  process.env.JWT_SECRET = 'test-secret'

  app = await buildApp()
})

// ─── POST /auth/google ─────────────────────────────────────────────────────────

describe('POST /auth/google (loginWithGoogle)', () => {
  it('should return tokens and user on valid Cognito ID token', async () => {
    // Setup mocks for Cognito token verification
    ;(jwt.decode as ReturnType<typeof vi.fn>).mockReturnValue({
      header: { kid: 'test-kid', alg: 'RS256' },
      payload: mockCognitoClaims,
    })
    ;(jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(mockCognitoClaims)
    ;(prisma.user.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)

    const response = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { idToken: 'valid-cognito-token' },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe('john@example.com')
    expect(body.accessToken).toBeDefined()
    expect(body.refreshToken).toBeDefined()

    // Verify user was upserted with correct data
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cognitoId: 'cognito-sub-123' },
        create: expect.objectContaining({
          email: 'john@example.com',
          name: 'John Doe',
          cognitoId: 'cognito-sub-123',
        }),
      })
    )
  })

  it('should return 401 when Cognito token is invalid', async () => {
    ;(jwt.decode as ReturnType<typeof vi.fn>).mockReturnValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { idToken: 'invalid-token' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBeDefined()
  })

  it('should return 401 when Cognito token verification fails', async () => {
    ;(jwt.decode as ReturnType<typeof vi.fn>).mockReturnValue({
      header: { kid: 'test-kid', alg: 'RS256' },
      payload: mockCognitoClaims,
    })
    ;(jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Token expired')
    })

    const response = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { idToken: 'expired-token' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toContain('Token expired')
  })

  it('should return 400 when idToken is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('Validation error')
  })

  it('should return 400 when idToken is empty', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { idToken: '' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('Validation error')
  })
})

// ─── POST /auth/refresh ────────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('should return a new access token for a valid refresh token', async () => {
    // Issue a real refresh token using the app's JWT
    const refreshToken = app.jwt.sign(
      { sub: 'user-123', type: 'refresh' },
      { expiresIn: '7d' }
    )

    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.accessToken).toBeDefined()
    expect(body.user).toBeDefined()
    expect(body.user.id).toBe('user-123')
  })

  it('should return 401 for an expired refresh token', async () => {
    // Issue a token that's already expired (negative expiresIn)
    const refreshToken = app.jwt.sign(
      { sub: 'user-123', type: 'refresh' },
      { expiresIn: '-1s' }
    )

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toBeDefined()
  })

  it('should return 401 for a tampered refresh token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'not.a.valid.jwt' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('should return 401 when user no longer exists', async () => {
    const refreshToken = app.jwt.sign(
      { sub: 'deleted-user', type: 'refresh' },
      { expiresIn: '7d' }
    )

    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    })

    expect(response.statusCode).toBe(401)
  })

  it('should return 400 when refreshToken is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('Validation error')
  })
})

// ─── GET /auth/me ──────────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  it('should return the authenticated user profile', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)

    // Create a valid access token
    const accessToken = app.jwt.sign({
      sub: 'user-123',
      email: 'john@example.com',
      role: 'admin',
    })

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json()
    expect(body.id).toBe('user-123')
    expect(body.email).toBe('john@example.com')
  })

  it('should return 401 without an access token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
    })

    expect(response.statusCode).toBe(401)
  })

  it('should return 401 with an invalid access token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    })

    expect(response.statusCode).toBe(401)
  })

  it('should return 404 when user is not found in DB', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const accessToken = app.jwt.sign({
      sub: 'nonexistent-user',
      email: 'ghost@example.com',
      role: 'user',
    })

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('User not found')
  })
})
