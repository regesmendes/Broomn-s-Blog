import { describe, it, expect, vi } from 'vitest'
import { createTestApp, generateAdminToken, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'

const mockPrisma = prisma as unknown as {
  post: { [k: string]: ReturnType<typeof vi.fn> }
  tag: { [k: string]: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

describe('Posts API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  // ── GET /posts ─────────────────────────────────────────────────────────────

  describe('GET /posts', () => {
    it('returns paginated list of published posts', async () => {
      const mockPosts = [
        {
          id: '1',
          title: 'Test Post',
          slug: 'test-post',
          excerpt: 'A test',
          coverImage: null,
          status: 'PUBLISHED',
          publishedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          tags: [{ tag: { id: 't1', name: 'Node', slug: 'node' } }],
        },
      ]

      mockPrisma.post.findMany.mockResolvedValue(mockPosts)

      const res = await app.inject({
        method: 'GET',
        url: '/posts',
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.data[0].title).toBe('Test Post')
      expect(body.data[0].tags[0].name).toBe('Node')
      expect(body.meta.hasMore).toBe(false)
      expect(body.meta.nextCursor).toBe(null)
    })

    it('returns empty list when no posts', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'GET',
        url: '/posts',
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(0)
      expect(body.meta.hasMore).toBe(false)
    })

    it('respects cursor and limit query params', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      await app.inject({
        method: 'GET',
        url: '/posts?cursor=post-1&limit=5',
      })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: { id: 'post-1' }, skip: 1, take: 6 })
      )
    })
  })

  // ── GET /posts/admin (admin — all posts, any status) ─────────────────────────

  describe('GET /posts/admin', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/posts/admin',
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'GET',
        url: '/posts/admin',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns posts of any status with a total count', async () => {
      const token = generateAdminToken(app)
      mockPrisma.post.count.mockResolvedValue(2)
      mockPrisma.post.findMany.mockResolvedValue([
        { id: '1', title: 'Draft Post', slug: 'draft-post', excerpt: null, coverImage: null, status: 'DRAFT', publishedAt: null, createdAt: new Date(), tags: [] },
        { id: '2', title: 'Published Post', slug: 'published-post', excerpt: null, coverImage: null, status: 'PUBLISHED', publishedAt: new Date(), createdAt: new Date(), tags: [] },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/posts/admin',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(2)
      expect(body.meta.total).toBe(2)
      expect(mockPrisma.post.count).toHaveBeenCalledWith({ where: {} })
    })

    it('filters by status when provided', async () => {
      const token = generateAdminToken(app)
      mockPrisma.post.count.mockResolvedValue(1)
      mockPrisma.post.findMany.mockResolvedValue([
        { id: '1', title: 'Draft Post', slug: 'draft-post', excerpt: null, coverImage: null, status: 'DRAFT', publishedAt: null, createdAt: new Date(), tags: [] },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/posts/admin?status=DRAFT',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(mockPrisma.post.count).toHaveBeenCalledWith({ where: { status: 'DRAFT' } })
    })
  })

  // ── GET /posts/:slug ───────────────────────────────────────────────────────

  describe('GET /posts/:slug', () => {
    it('returns a post by slug', async () => {
      const mockPost = {
        id: '1',
        title: 'Test Post',
        slug: 'test-post',
        excerpt: 'A test',
        content: '<p>Hello</p>',
        coverImage: null,
        status: 'PUBLISHED',
        publishedAt: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        tags: [],
      }

      mockPrisma.post.findFirst.mockResolvedValue(mockPost)

      const res = await app.inject({
        method: 'GET',
        url: '/posts/test-post',
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().title).toBe('Test Post')
    })

    it('returns 404 for non-existent slug', async () => {
      mockPrisma.post.findFirst.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/posts/non-existent',
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── POST /posts ────────────────────────────────────────────────────────────

  describe('POST /posts', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        payload: { title: 'Test', content: 'Content' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Test', content: 'Content' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('creates a post for admin users', async () => {
      const token = generateAdminToken(app)

      mockPrisma.post.findUnique.mockResolvedValue(null) // slug not taken
      mockPrisma.post.create.mockResolvedValue({
        id: 'new-id',
        title: 'New Post',
        slug: 'new-post',
        excerpt: null,
        content: '<p>Content</p>',
        coverImage: null,
        status: 'DRAFT',
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      })

      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'New Post', content: '<p>Content</p>' },
      })

      expect(res.statusCode).toBe(201)
      expect(res.json().title).toBe('New Post')
      expect(res.json().slug).toBe('new-post')
    })
  })

  // ── PUT /posts/:id ─────────────────────────────────────────────────────────

  describe('PUT /posts/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/posts/some-id',
        payload: { title: 'Updated' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 404 for non-existent post', async () => {
      const token = generateAdminToken(app)
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PUT',
        url: '/posts/non-existent',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Updated' },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── DELETE /posts/:id ──────────────────────────────────────────────────────

  describe('DELETE /posts/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/posts/some-id',
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'DELETE',
        url: '/posts/some-id',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns 404 for non-existent post', async () => {
      const token = generateAdminToken(app)
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: '/posts/non-existent',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── PATCH /posts/:id/publish ───────────────────────────────────────────────

  describe('PATCH /posts/:id/publish', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/posts/some-id/publish',
        payload: { status: 'PUBLISHED' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('publishes a post with a scheduled date', async () => {
      const token = generateAdminToken(app)
      const publishDate = '2025-06-01T10:00:00.000Z'

      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'post-1',
        title: 'Test',
        slug: 'test',
        content: 'x',
        status: 'DRAFT',
        tags: [],
      })

      mockPrisma.post.update.mockResolvedValue({
        id: 'post-1',
        title: 'Test',
        slug: 'test',
        content: 'x',
        status: 'PUBLISHED',
        publishedAt: new Date(publishDate),
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      })

      const res = await app.inject({
        method: 'PATCH',
        url: '/posts/post-1/publish',
        headers: { authorization: `Bearer ${token}` },
        payload: { status: 'PUBLISHED', publishedAt: publishDate },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().status).toBe('PUBLISHED')
    })
  })
})
