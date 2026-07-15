import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildApp } from '../app'
import type { FastifyInstance } from 'fastify'

// ─── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('jwks-rsa', () => ({
  default: () => ({
    getSigningKey: vi.fn().mockResolvedValue({
      getPublicKey: () => 'mock-public-key',
    }),
  }),
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    decode: vi.fn(),
    verify: vi.fn(),
  },
}))

import { prisma } from '../lib/prisma'

// ─── Helpers ───────────────────────────────────────────────────────────────────

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()

  process.env.AWS_REGION = 'us-east-1'
  process.env.AWS_COGNITO_USER_POOL_ID = 'us-east-1_TestPool'
  process.env.AWS_COGNITO_CLIENT_ID = 'test-client-id'
  process.env.JWT_SECRET = 'test-secret'

  app = await buildApp()
})

function signToken(payload: { sub: string; email: string; role: 'admin' | 'user' }) {
  return app.jwt.sign(payload, { expiresIn: '15m' })
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('authorize middleware', () => {
  describe('admin routes require admin role', () => {
    it('should allow an admin user to access admin routes', async () => {
      const token = signToken({
        sub: 'admin-user-1',
        email: 'admin@example.com',
        role: 'admin',
      })

      // Mock post creation
      ;(prisma.post.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'post-1',
        title: 'Test Post',
        slug: 'test-post',
        content: 'Hello world',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      })

      const response = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Test Post',
          content: 'Hello world',
        },
      })

      // Admin should be allowed through (201 = success for post creation)
      expect(response.statusCode).toBe(201)
    })

    it('should return 403 when a regular user tries to create a post', async () => {
      const token = signToken({
        sub: 'regular-user-1',
        email: 'user@example.com',
        role: 'user',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Test Post',
          content: 'Hello world',
        },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Forbidden')
    })

    it('should return 403 when a regular user tries to update a post', async () => {
      const token = signToken({
        sub: 'regular-user-1',
        email: 'user@example.com',
        role: 'user',
      })

      const response = await app.inject({
        method: 'PUT',
        url: '/posts/some-id',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Updated Title',
          content: 'Updated content',
        },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Forbidden')
    })

    it('should return 403 when a regular user tries to delete a post', async () => {
      const token = signToken({
        sub: 'regular-user-1',
        email: 'user@example.com',
        role: 'user',
      })

      const response = await app.inject({
        method: 'DELETE',
        url: '/posts/some-id',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Forbidden')
    })

    it('should return 403 when a regular user tries to publish a post', async () => {
      const token = signToken({
        sub: 'regular-user-1',
        email: 'user@example.com',
        role: 'user',
      })

      const response = await app.inject({
        method: 'PATCH',
        url: '/posts/some-id/publish',
        headers: { authorization: `Bearer ${token}` },
        payload: { published: true },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Forbidden')
    })

    it('should return 403 when a regular user tries to get a post by id (admin route)', async () => {
      const token = signToken({
        sub: 'regular-user-1',
        email: 'user@example.com',
        role: 'user',
      })

      const response = await app.inject({
        method: 'GET',
        url: '/posts/admin/some-id',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(response.statusCode).toBe(403)
      expect(response.json().error).toBe('Forbidden')
    })
  })

  describe('authentication is still required before authorization', () => {
    it('should return 401 (not 403) when no token is provided on admin routes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: {
          title: 'Test Post',
          content: 'Hello world',
        },
      })

      // Must get 401 from authenticate, not 403 from authorize
      expect(response.statusCode).toBe(401)
      expect(response.json().error).toBe('Unauthorized')
    })

    it('should return 401 when an invalid token is provided on admin routes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: 'Bearer invalid.jwt.token' },
        payload: {
          title: 'Test Post',
          content: 'Hello world',
        },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json().error).toBe('Unauthorized')
    })
  })

  describe('public routes remain accessible', () => {
    it('should allow unauthenticated access to GET /posts', async () => {
      ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
      ;(prisma.post.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

      const response = await app.inject({
        method: 'GET',
        url: '/posts',
      })

      // Should not be 401 or 403 — the route is publicly accessible
      expect(response.statusCode).not.toBe(401)
      expect(response.statusCode).not.toBe(403)
    })

    it('should allow unauthenticated access to GET /posts/:slug', async () => {
      ;(prisma.post.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const response = await app.inject({
        method: 'GET',
        url: '/posts/some-slug',
      })

      // Should not be 401 or 403 — the route is publicly accessible
      expect(response.statusCode).not.toBe(401)
      expect(response.statusCode).not.toBe(403)
    })
  })
})
