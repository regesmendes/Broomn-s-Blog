import { describe, it, expect, vi } from 'vitest'
import { createTestApp, generateAdminToken, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'

const mockPrisma = prisma as unknown as {
  comment: { [k: string]: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

describe('Comments API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  // ── GET /posts/:postId/comments ────────────────────────────────────────────

  describe('GET /posts/:postId/comments', () => {
    it('returns paginated approved comments', async () => {
      const mockComments = [
        {
          id: 'c1',
          content: 'Great post!',
          approved: true,
          createdAt: new Date(),
          user: { id: 'u1', name: 'Alice', avatarUrl: null },
        },
      ]

      mockPrisma.comment.findMany.mockResolvedValue(mockComments)

      const res = await app.inject({
        method: 'GET',
        url: '/posts/post-123/comments',
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].content).toBe('Great post!')
      expect(body.meta.hasMore).toBe(false)
    })

    it('returns empty list for post with no comments', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/posts/post-456/comments',
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toHaveLength(0)
    })
  })

  // ── GET /posts/:postId/comments/all (admin) ────────────────────────────────

  describe('GET /posts/:postId/comments/all', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts/post-123/comments/all',
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'GET',
        url: '/posts/post-123/comments/all',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns all comments for admin', async () => {
      const token = generateAdminToken(app)
      mockPrisma.comment.findMany.mockResolvedValue([
        { id: 'c1', content: 'Approved', approved: true, createdAt: new Date(), user: { id: 'u1', name: 'A', avatarUrl: null } },
        { id: 'c2', content: 'Pending', approved: false, createdAt: new Date(), user: { id: 'u2', name: 'B', avatarUrl: null } },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/posts/post-123/comments/all',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toHaveLength(2)
    })
  })

  // ── GET /comments/admin (global admin view) ────────────────────────────────

  describe('GET /comments/admin', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/comments/admin',
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns comments across all posts with a total count', async () => {
      const token = generateAdminToken(app)
      mockPrisma.comment.count.mockResolvedValue(2)
      mockPrisma.comment.findMany.mockResolvedValue([
        { id: 'c1', content: 'A', approved: false, createdAt: new Date(), user: { id: 'u1', name: 'A', avatarUrl: null }, post: { id: 'p1', title: 'Post', slug: 'post' } },
        { id: 'c2', content: 'B', approved: false, createdAt: new Date(), user: { id: 'u2', name: 'B', avatarUrl: null }, post: { id: 'p1', title: 'Post', slug: 'post' } },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/comments/admin?approved=false',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(2)
      expect(body.meta.total).toBe(2)
      expect(body.meta.hasMore).toBe(false)
      expect(mockPrisma.comment.count).toHaveBeenCalledWith({ where: { approved: false } })
    })
  })

  // ── POST /posts/:postId/comments ───────────────────────────────────────────

  describe('POST /posts/:postId/comments', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts/post-123/comments',
        payload: { content: 'Nice post!' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('creates a comment for authenticated user', async () => {
      const token = generateTestToken(app, { sub: 'user-789' })

      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        id: 'new-comment',
        content: 'Nice post!',
        approved: false,
        createdAt: new Date(),
        user: { id: 'user-789', name: 'Test', avatarUrl: null },
      })

      const res = await app.inject({
        method: 'POST',
        url: '/posts/post-123/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'Nice post!' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().content).toBe('Nice post!')
      expect(res.json().approved).toBe(false)
      expect(mockPrisma.comment.count).toHaveBeenCalledWith({
        where: { userId: 'user-789', approved: false },
      })
    })

    it('returns 429 when the user has reached the pending-comment limit', async () => {
      const token = generateTestToken(app, { sub: 'user-789' })

      mockPrisma.comment.count.mockResolvedValue(15)

      const res = await app.inject({
        method: 'POST',
        url: '/posts/post-123/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'One more!' },
      })

      expect(res.statusCode).toBe(429)
      expect(res.json().error).toMatch(/too many comments/i)
      expect(mockPrisma.comment.create).not.toHaveBeenCalled()
    })

    it('respects a custom MAX_PENDING_COMMENTS_PER_USER', async () => {
      const original = process.env.MAX_PENDING_COMMENTS_PER_USER
      process.env.MAX_PENDING_COMMENTS_PER_USER = '2'

      const token = generateTestToken(app, { sub: 'user-789' })
      mockPrisma.comment.count.mockResolvedValue(2)

      const res = await app.inject({
        method: 'POST',
        url: '/posts/post-123/comments',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: 'One more!' },
      })

      expect(res.statusCode).toBe(429)

      process.env.MAX_PENDING_COMMENTS_PER_USER = original
    })
  })

  // ── PATCH /comments/:id/approve ────────────────────────────────────────────

  describe('PATCH /comments/:id/approve', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/comments/c1/approve',
        payload: { approved: true },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'PATCH',
        url: '/comments/c1/approve',
        headers: { authorization: `Bearer ${token}` },
        payload: { approved: true },
      })

      expect(res.statusCode).toBe(403)
    })

    it('approves a comment for admin', async () => {
      const token = generateAdminToken(app)

      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        content: 'Pending comment',
        approved: false,
        createdAt: new Date(),
        user: { id: 'u1', name: 'Test', avatarUrl: null },
      })

      mockPrisma.comment.update.mockResolvedValue({
        id: 'c1',
        content: 'Pending comment',
        approved: true,
        createdAt: new Date(),
        user: { id: 'u1', name: 'Test', avatarUrl: null },
      })

      const res = await app.inject({
        method: 'PATCH',
        url: '/comments/c1/approve',
        headers: { authorization: `Bearer ${token}` },
        payload: { approved: true },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().approved).toBe(true)
    })
  })

  // ── DELETE /comments/:id ───────────────────────────────────────────────────

  describe('DELETE /comments/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/comments/c1',
      })

      expect(res.statusCode).toBe(401)
    })

    it('allows owner to delete their own comment', async () => {
      const token = generateTestToken(app, { sub: 'user-owner' })

      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        content: 'My comment',
        approved: true,
        createdAt: new Date(),
        user: { id: 'user-owner', name: 'Owner', avatarUrl: null },
      })

      mockPrisma.comment.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE',
        url: '/comments/c1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(204)
    })

    it('returns 403 if not owner and not admin', async () => {
      const token = generateTestToken(app, { sub: 'other-user' })

      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        content: 'Someone else comment',
        approved: true,
        createdAt: new Date(),
        user: { id: 'user-owner', name: 'Owner', avatarUrl: null },
      })

      const res = await app.inject({
        method: 'DELETE',
        url: '/comments/c1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('allows admin to delete any comment', async () => {
      const token = generateAdminToken(app)

      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'c1',
        content: 'Any comment',
        approved: true,
        createdAt: new Date(),
        user: { id: 'some-user', name: 'User', avatarUrl: null },
      })

      mockPrisma.comment.delete.mockResolvedValue({})

      const res = await app.inject({
        method: 'DELETE',
        url: '/comments/c1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(204)
    })
  })
})
