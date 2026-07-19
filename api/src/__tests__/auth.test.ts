import { describe, it, expect, vi } from 'vitest'
import { createTestApp, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'
import { JwtPayload } from '../types'

const mockPrisma = prisma as unknown as {
  user: { [k: string]: ReturnType<typeof vi.fn> }
}

describe('Auth API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  // ── POST /auth/google ──────────────────────────────────────────────────────

  describe('POST /auth/google', () => {
    it('returns 401 with invalid token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/google',
        payload: { idToken: 'invalid.token.here' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 400 with missing idToken', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/google',
        payload: {},
      })

      // Zod validation throws — our error handler catches it as 400
      expect(res.statusCode).toBe(400)
    })
  })

  // ── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns 401 with invalid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: 'bad.token' },
      })

      expect(res.statusCode).toBe(401)
      expect(res.json().error).toBe('Invalid or expired refresh token')
    })

    it('returns new access token with valid refresh token', async () => {
      // Generate a refresh token the same way the auth service does
      const refreshToken = app.jwt.sign(
        { sub: 'user-123', type: 'refresh' } as unknown as JwtPayload,
        { expiresIn: '7d' }
      )

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        role: 'USER',
        googleId: null,
        cognitoId: null,
        createdAt: new Date(),
      })

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.accessToken).toBeDefined()
      expect(body.user.id).toBe('user-123')
    })
  })

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns user profile with valid token', async () => {
      const token = generateTestToken(app, { sub: 'user-456' })

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-456',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        role: 'USER',
        googleId: null,
        cognitoId: null,
        createdAt: new Date(),
      })

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().id).toBe('user-456')
    })

    it('returns 404 if user not found in database', async () => {
      const token = generateTestToken(app, { sub: 'deleted-user' })
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })
})
