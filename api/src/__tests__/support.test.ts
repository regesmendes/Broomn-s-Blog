import { describe, it, expect, vi } from 'vitest'
import { createTestApp, generateAdminToken, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'

const mockPrisma = prisma as unknown as {
  supportPage: { [k: string]: ReturnType<typeof vi.fn> }
  mediaOnSupportPage: { [k: string]: ReturnType<typeof vi.fn> }
  media: { [k: string]: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

describe('Support API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  const mockSupport = {
    id: 'support-page-singleton',
    content: '<p>Content coming soon.</p>',
    updatedAt: new Date('2026-01-01'),
  }

  // ── GET /support ─────────────────────────────────────────────────────────────

  describe('GET /support', () => {
    it('returns the support page content (public, no auth needed)', async () => {
      mockPrisma.supportPage.findFirst.mockResolvedValue(mockSupport)

      const res = await app.inject({ method: 'GET', url: '/support' })

      expect(res.statusCode).toBe(200)
      expect(res.json().content).toBe('<p>Content coming soon.</p>')
    })

    it('returns 404 if the singleton row is somehow missing', async () => {
      mockPrisma.supportPage.findFirst.mockResolvedValue(null)

      const res = await app.inject({ method: 'GET', url: '/support' })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── PUT /support ─────────────────────────────────────────────────────────────

  describe('PUT /support', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/support',
        payload: { content: '<p>Updated</p>' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'PUT',
        url: '/support',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '<p>Updated</p>' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('rejects an empty content body', async () => {
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'PUT',
        url: '/support',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('updates the content and syncs media usage for admin', async () => {
      const token = generateAdminToken(app)
      const newContent =
        '<p>Say thanks</p><img src="https://bucket.s3.amazonaws.com/abcdefab-1234-1234-1234-abcdefabcdef.png">'

      mockPrisma.supportPage.findFirst.mockResolvedValue(mockSupport)
      mockPrisma.supportPage.update.mockResolvedValue({ ...mockSupport, content: newContent })
      mockPrisma.media.findMany.mockResolvedValue([{ id: 'media-1' }])
      mockPrisma.$transaction.mockResolvedValue([])

      const res = await app.inject({
        method: 'PUT',
        url: '/support',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: newContent },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().content).toBe(newContent)
      expect(mockPrisma.supportPage.update).toHaveBeenCalledWith({
        where: { id: mockSupport.id },
        data: { content: newContent },
      })
      expect(mockPrisma.media.findMany).toHaveBeenCalledWith({
        where: { filename: { in: ['abcdefab-1234-1234-1234-abcdefabcdef.png'] } },
        select: { id: true },
      })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('clears media usage when no images remain in the content', async () => {
      const token = generateAdminToken(app)

      mockPrisma.supportPage.findFirst.mockResolvedValue(mockSupport)
      mockPrisma.supportPage.update.mockResolvedValue({ ...mockSupport, content: '<p>No images</p>' })
      mockPrisma.mediaOnSupportPage.deleteMany.mockResolvedValue({ count: 1 })

      const res = await app.inject({
        method: 'PUT',
        url: '/support',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '<p>No images</p>' },
      })

      expect(res.statusCode).toBe(200)
      expect(mockPrisma.mediaOnSupportPage.deleteMany).toHaveBeenCalledWith({
        where: { supportPageId: mockSupport.id },
      })
    })
  })
})
