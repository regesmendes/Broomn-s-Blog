import { describe, it, expect, vi } from 'vitest'
import { createTestApp, generateAdminToken, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'

const mockPrisma = prisma as unknown as {
  aboutPage: { [k: string]: ReturnType<typeof vi.fn> }
  mediaOnAboutPage: { [k: string]: ReturnType<typeof vi.fn> }
  media: { [k: string]: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

describe('About API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  const mockAbout = {
    id: 'about-page-singleton',
    content: '<p>Content coming soon.</p>',
    updatedAt: new Date('2026-01-01'),
  }

  // ── GET /about ───────────────────────────────────────────────────────────────

  describe('GET /about', () => {
    it('returns the about page content (public, no auth needed)', async () => {
      mockPrisma.aboutPage.findFirst.mockResolvedValue(mockAbout)

      const res = await app.inject({ method: 'GET', url: '/about' })

      expect(res.statusCode).toBe(200)
      expect(res.json().content).toBe('<p>Content coming soon.</p>')
    })

    it('returns 404 if the singleton row is somehow missing', async () => {
      mockPrisma.aboutPage.findFirst.mockResolvedValue(null)

      const res = await app.inject({ method: 'GET', url: '/about' })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── PUT /about ───────────────────────────────────────────────────────────────

  describe('PUT /about', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/about',
        payload: { content: '<p>Updated</p>' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'PUT',
        url: '/about',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '<p>Updated</p>' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('rejects an empty content body', async () => {
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'PUT',
        url: '/about',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('updates the content and syncs media usage for admin', async () => {
      const token = generateAdminToken(app)
      const newContent =
        '<p>About us</p><img src="https://bucket.s3.amazonaws.com/abcdefab-1234-1234-1234-abcdefabcdef.png">'

      mockPrisma.aboutPage.findFirst.mockResolvedValue(mockAbout)
      mockPrisma.aboutPage.update.mockResolvedValue({ ...mockAbout, content: newContent })
      mockPrisma.media.findMany.mockResolvedValue([{ id: 'media-1' }])
      mockPrisma.$transaction.mockResolvedValue([])

      const res = await app.inject({
        method: 'PUT',
        url: '/about',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: newContent },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().content).toBe(newContent)
      expect(mockPrisma.aboutPage.update).toHaveBeenCalledWith({
        where: { id: mockAbout.id },
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

      mockPrisma.aboutPage.findFirst.mockResolvedValue(mockAbout)
      mockPrisma.aboutPage.update.mockResolvedValue({ ...mockAbout, content: '<p>No images</p>' })
      mockPrisma.mediaOnAboutPage.deleteMany.mockResolvedValue({ count: 1 })

      const res = await app.inject({
        method: 'PUT',
        url: '/about',
        headers: { authorization: `Bearer ${token}` },
        payload: { content: '<p>No images</p>' },
      })

      expect(res.statusCode).toBe(200)
      expect(mockPrisma.mediaOnAboutPage.deleteMany).toHaveBeenCalledWith({
        where: { aboutPageId: mockAbout.id },
      })
    })
  })
})
