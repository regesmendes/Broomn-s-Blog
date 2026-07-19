import { describe, it, expect, vi } from 'vitest'
import { createTestApp, generateAdminToken, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { uploadObject, deleteObject } from '../lib/s3'
import { FastifyInstance } from 'fastify'

const mockPrisma = prisma as unknown as {
  media: { [k: string]: ReturnType<typeof vi.fn> }
  post: { [k: string]: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

function buildMultipartUpload(filename: string, contentType: string, content: Buffer) {
  const boundary = '----testboundary123'
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  return {
    payload,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  }
}

describe('Media API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  const mockMedia = {
    id: 'media-1',
    filename: 'abc123.png',
    originalName: 'photo.png',
    mimeType: 'image/png',
    size: 12,
    url: 'https://broomns-blog-media.s3.us-east-1.amazonaws.com/abc123.png',
    createdAt: new Date('2026-01-01'),
  }

  // ── POST /media/upload ──────────────────────────────────────────────────────

  describe('POST /media/upload', () => {
    it('rejects non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })
      const { payload, headers } = buildMultipartUpload('photo.png', 'image/png', Buffer.from('fake-image'))

      const res = await app.inject({
        method: 'POST',
        url: '/media/upload',
        headers: { ...headers, authorization: `Bearer ${token}` },
        payload,
      })

      expect(res.statusCode).toBe(403)
    })

    it('rejects unsupported file types', async () => {
      const token = generateAdminToken(app)
      const { payload, headers } = buildMultipartUpload('doc.pdf', 'application/pdf', Buffer.from('fake-pdf'))

      const res = await app.inject({
        method: 'POST',
        url: '/media/upload',
        headers: { ...headers, authorization: `Bearer ${token}` },
        payload,
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toMatch(/Unsupported file type/)
    })

    it('rejects files over 5MB', async () => {
      // @fastify/multipart itself enforces this limit (registered with the same
      // 5MB cap in app.ts) and aborts the upload stream before the route's own
      // buffer.length check ever runs, so the observed status is 413, not 400.
      const token = generateAdminToken(app)
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 1)
      const { payload, headers } = buildMultipartUpload('photo.png', 'image/png', oversized)

      const res = await app.inject({
        method: 'POST',
        url: '/media/upload',
        headers: { ...headers, authorization: `Bearer ${token}` },
        payload,
      })

      expect(res.statusCode).toBe(413)
    })

    it('uploads to S3 and saves the returned URL to the database', async () => {
      const token = generateAdminToken(app)
      vi.mocked(uploadObject).mockResolvedValue(mockMedia.url)
      mockPrisma.media.create.mockResolvedValue(mockMedia)

      const { payload, headers } = buildMultipartUpload('photo.png', 'image/png', Buffer.from('fake-image'))

      const res = await app.inject({
        method: 'POST',
        url: '/media/upload',
        headers: { ...headers, authorization: `Bearer ${token}` },
        payload,
      })

      expect(res.statusCode).toBe(201)
      expect(uploadObject).toHaveBeenCalledWith(
        expect.stringMatching(/\.png$/),
        expect.any(Buffer),
        'image/png'
      )
      expect(mockPrisma.media.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ url: mockMedia.url, originalName: 'photo.png' }),
      })
      expect(res.json()).toEqual({
        ...mockMedia,
        createdAt: mockMedia.createdAt.toISOString(),
      })
    })
  })

  // ── GET /media ───────────────────────────────────────────────────────────────

  describe('GET /media', () => {
    it('returns paginated media with usage counts', async () => {
      const token = generateAdminToken(app)
      mockPrisma.media.findMany.mockResolvedValue([{ ...mockMedia, _count: { posts: 2 } }])

      const res = await app.inject({
        method: 'GET',
        url: '/media',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data[0].usageCount).toBe(2)
      expect(res.json().meta.hasMore).toBe(false)
    })
  })

  // ── GET /media/:id ───────────────────────────────────────────────────────────

  describe('GET /media/:id', () => {
    it('returns 404 for a non-existent media item', async () => {
      const token = generateAdminToken(app)
      mockPrisma.media.findUnique.mockResolvedValue(null)

      const res = await app.inject({
        method: 'GET',
        url: '/media/non-existent',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })
  })

  // ── DELETE /media/:id ──────────────────────────────────────────────────────

  describe('DELETE /media/:id', () => {
    it('deletes the S3 object and the database record', async () => {
      const token = generateAdminToken(app)
      mockPrisma.media.findUnique.mockResolvedValue({ ...mockMedia, _count: { posts: 0 } })
      mockPrisma.media.delete.mockResolvedValue(mockMedia)

      const res = await app.inject({
        method: 'DELETE',
        url: `/media/${mockMedia.id}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(204)
      expect(deleteObject).toHaveBeenCalledWith(mockMedia.filename)
      expect(mockPrisma.media.delete).toHaveBeenCalledWith({ where: { id: mockMedia.id } })
    })

    it('still deletes the database record if the S3 object is already gone', async () => {
      const token = generateAdminToken(app)
      mockPrisma.media.findUnique.mockResolvedValue({ ...mockMedia, _count: { posts: 0 } })
      mockPrisma.media.delete.mockResolvedValue(mockMedia)
      vi.mocked(deleteObject).mockRejectedValueOnce(new Error('NoSuchKey'))

      const res = await app.inject({
        method: 'DELETE',
        url: `/media/${mockMedia.id}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(204)
      expect(mockPrisma.media.delete).toHaveBeenCalled()
    })
  })

  // ── PATCH /media/:id/replace ─────────────────────────────────────────────────

  describe('PATCH /media/:id/replace', () => {
    it('replaces the image URL across all posts using it', async () => {
      const token = generateAdminToken(app)
      const post = { id: 'post-1', content: `<img src="${mockMedia.url}">` }
      mockPrisma.media.findUnique.mockResolvedValue({
        ...mockMedia,
        posts: [{ post }],
      })
      mockPrisma.post.update.mockResolvedValue(post)

      const res = await app.inject({
        method: 'PATCH',
        url: `/media/${mockMedia.id}/replace`,
        headers: { authorization: `Bearer ${token}` },
        payload: { newUrl: 'https://broomns-blog-media.s3.us-east-1.amazonaws.com/new.png' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().postsUpdated).toBe(1)
      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { content: '<img src="https://broomns-blog-media.s3.us-east-1.amazonaws.com/new.png">' },
      })
    })
  })
})
