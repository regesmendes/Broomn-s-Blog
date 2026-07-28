import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createTestApp, generateAdminToken, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'

const mockPrisma = prisma as unknown as {
  tag: { [k: string]: ReturnType<typeof vi.fn> }
  tagsOnPosts: { [k: string]: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

describe('Tags API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  const photographyTag = { id: 'tag-1', name: 'Photography', slug: 'photography', _count: { posts: 3 } }
  const phytographyTag = { id: 'tag-2', name: 'Phytography', slug: 'phytography', _count: { posts: 1 } }

  // ── GET /tags ────────────────────────────────────────────────────────────────

  describe('GET /tags', () => {
    it('returns all tags with post counts, no auth required', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([photographyTag, phytographyTag])

      const res = await app.inject({ method: 'GET', url: '/tags' })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual([
        { id: 'tag-1', name: 'Photography', slug: 'photography', postCount: 3 },
        { id: 'tag-2', name: 'Phytography', slug: 'phytography', postCount: 1 },
      ])
    })
  })

  // ── GET /tags/admin ──────────────────────────────────────────────────────────

  describe('GET /tags/admin', () => {
    it('rejects non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'GET',
        url: '/tags/admin',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns paginated tags with post counts', async () => {
      const token = generateAdminToken(app)
      mockPrisma.tag.findMany.mockResolvedValue([photographyTag, phytographyTag])

      const res = await app.inject({
        method: 'GET',
        url: '/tags/admin',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({
        data: [
          { id: 'tag-1', name: 'Photography', slug: 'photography', postCount: 3 },
          { id: 'tag-2', name: 'Phytography', slug: 'phytography', postCount: 1 },
        ],
        meta: { nextCursor: null, hasMore: false },
      })
    })

    it('filters by a case-insensitive search term', async () => {
      const token = generateAdminToken(app)
      mockPrisma.tag.findMany.mockResolvedValue([phytographyTag])

      const res = await app.inject({
        method: 'GET',
        url: '/tags/admin?search=phyto',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'phyto', mode: 'insensitive' } },
        })
      )
      expect(res.json().data).toEqual([
        { id: 'tag-2', name: 'Phytography', slug: 'phytography', postCount: 1 },
      ])
    })
  })

  // ── PATCH /tags/:id ──────────────────────────────────────────────────────────

  describe('PATCH /tags/:id', () => {
    it('rejects non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'PATCH',
        url: '/tags/tag-2',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Photography' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns 404 for a non-existent tag', async () => {
      const token = generateAdminToken(app)
      mockPrisma.tag.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PATCH',
        url: '/tags/does-not-exist',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Anything' },
      })

      expect(res.statusCode).toBe(404)
    })

    it('renames a tag when the new name does not collide with another tag', async () => {
      const token = generateAdminToken(app)
      mockPrisma.tag.findUnique.mockResolvedValue(phytographyTag)
      mockPrisma.tag.findFirst.mockResolvedValue(null) // no other tag uses this slug
      mockPrisma.tag.update.mockResolvedValue({
        id: 'tag-2', name: 'Botany', slug: 'botany', _count: { posts: 1 },
      })

      const res = await app.inject({
        method: 'PATCH',
        url: '/tags/tag-2',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Botany' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ id: 'tag-2', name: 'Botany', slug: 'botany', postCount: 1 })
      expect(mockPrisma.tag.update).toHaveBeenCalledWith({
        where:  { id: 'tag-2' },
        data:   { name: 'Botany', slug: 'botany' },
        select: expect.any(Object),
      })
      expect(mockPrisma.tag.delete).not.toHaveBeenCalled()
    })

    it('merges into the existing tag when the new name collides, reassigning posts and dropping duplicates', async () => {
      const token = generateAdminToken(app)
      // Renaming the typo'd "Phytography" (tag-2) to "Photography" collides with tag-1
      mockPrisma.tag.findUnique.mockResolvedValueOnce(phytographyTag) // findById(id)
      mockPrisma.tag.findFirst.mockResolvedValue(photographyTag) // collision found

      // tag-2 is on posts A and B; tag-1 (target) is already on post B
      mockPrisma.tagsOnPosts.findMany
        .mockResolvedValueOnce([{ postId: 'post-A' }, { postId: 'post-B' }]) // source links
        .mockResolvedValueOnce([{ postId: 'post-B' }]) // target links

      mockPrisma.tagsOnPosts.createMany.mockResolvedValue({ count: 1 })
      mockPrisma.tag.delete.mockResolvedValue(phytographyTag)
      mockPrisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops))
      mockPrisma.tag.findUnique.mockResolvedValueOnce({
        ...photographyTag,
        _count: { posts: 4 },
      }) // re-fetch of merged target

      const res = await app.inject({
        method: 'PATCH',
        url: '/tags/tag-2',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Photography' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ id: 'tag-1', name: 'Photography', slug: 'photography', postCount: 4 })

      // Only post-A needed a new link — post-B already had the target tag
      expect(mockPrisma.tagsOnPosts.createMany).toHaveBeenCalledWith({
        data: [{ postId: 'post-A', tagId: 'tag-1' }],
      })
      expect(mockPrisma.tag.delete).toHaveBeenCalledWith({ where: { id: 'tag-2' } })
    })
  })

  // ── DELETE /tags/:id ─────────────────────────────────────────────────────────

  describe('DELETE /tags/:id', () => {
    it('rejects non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'DELETE',
        url: '/tags/tag-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns 404 for a non-existent tag', async () => {
      const token = generateAdminToken(app)
      mockPrisma.tag.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: '/tags/does-not-exist',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

    it('deletes a tag even when it is still attached to posts', async () => {
      const token = generateAdminToken(app)
      mockPrisma.tag.findUnique.mockResolvedValue(photographyTag) // 3 posts attached
      mockPrisma.tag.delete.mockResolvedValue(photographyTag)

      const res = await app.inject({
        method: 'DELETE',
        url: '/tags/tag-1',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(204)
      expect(mockPrisma.tag.delete).toHaveBeenCalledWith({ where: { id: 'tag-1' } })
    })
  })
})
