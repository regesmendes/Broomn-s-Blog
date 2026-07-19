import { describe, it, expect, vi } from 'vitest'
import { createTestApp, generateAdminToken, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'
import { createHmac } from 'crypto'

const mockPrisma = prisma as unknown as {
  newsletter: { [k: string]: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}

/** Generate a valid newsletter token for testing */
function generateNewsletterToken(subscriberId: string): string {
  const secret = process.env.JWT_SECRET ?? 'change-me-in-production'
  const hmac = createHmac('sha256', secret).update(subscriberId).digest('hex')
  return Buffer.from(`${subscriberId}:${hmac}`).toString('base64url')
}

describe('Newsletter API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  // ── POST /newsletter/subscribe ─────────────────────────────────────────────

  describe('POST /newsletter/subscribe', () => {
    it('subscribes with a valid email', async () => {
      mockPrisma.newsletter.upsert.mockResolvedValue({
        id: 'sub-1',
        email: 'reader@example.com',
        status: 'PENDING',
        confirmedAt: null,
        createdAt: new Date(),
      })

      const res = await app.inject({
        method: 'POST',
        url: '/newsletter/subscribe',
        payload: { email: 'reader@example.com' },
      })

      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.message).toContain('pending')
      expect(body.subscriber.email).toBe('reader@example.com')
      expect(body.subscriber.status).toBe('PENDING')
    })

    it('rejects invalid email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/newsletter/subscribe',
        payload: { email: 'not-an-email' },
      })

      expect(res.statusCode).toBe(400) // Zod validation error
    })
  })

  // ── GET /newsletter/confirm ────────────────────────────────────────────────

  describe('GET /newsletter/confirm', () => {
    it('confirms subscription with valid token', async () => {
      const token = generateNewsletterToken('sub-1')

      mockPrisma.newsletter.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'reader@example.com',
        status: 'PENDING',
        confirmedAt: null,
        createdAt: new Date(),
      })

      mockPrisma.newsletter.update.mockResolvedValue({
        id: 'sub-1',
        email: 'reader@example.com',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        createdAt: new Date(),
      })

      const res = await app.inject({
        method: 'GET',
        url: `/newsletter/confirm?token=${token}`,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().message).toContain('confirmed')
      expect(res.json().subscriber.status).toBe('CONFIRMED')
    })

    it('rejects invalid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/newsletter/confirm?token=invalid-token',
      })

      expect(res.statusCode).toBe(400)
      expect(res.json().error).toContain('Invalid')
    })
  })

  // ── GET /newsletter/unsubscribe ────────────────────────────────────────────

  describe('GET /newsletter/unsubscribe', () => {
    it('unsubscribes with valid token', async () => {
      const token = generateNewsletterToken('sub-1')

      mockPrisma.newsletter.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'reader@example.com',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        createdAt: new Date(),
      })

      mockPrisma.newsletter.update.mockResolvedValue({
        id: 'sub-1',
        email: 'reader@example.com',
        status: 'UNSUBSCRIBED',
        confirmedAt: new Date(),
        createdAt: new Date(),
      })

      const res = await app.inject({
        method: 'GET',
        url: `/newsletter/unsubscribe?token=${token}`,
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().message).toContain('unsubscribed')
    })

    it('rejects invalid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/newsletter/unsubscribe?token=bad',
      })

      expect(res.statusCode).toBe(400)
    })
  })

  // ── GET /newsletter/subscribers (admin) ────────────────────────────────────

  describe('GET /newsletter/subscribers', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/newsletter/subscribers',
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'GET',
        url: '/newsletter/subscribers',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns paginated subscribers with status counts for admin', async () => {
      const token = generateAdminToken(app)

      mockPrisma.newsletter.findMany.mockResolvedValue([
        { id: 'sub-1', email: 'reader@example.com', status: 'CONFIRMED', confirmedAt: new Date(), createdAt: new Date() },
      ])
      mockPrisma.newsletter.groupBy.mockResolvedValue([
        { status: 'CONFIRMED', _count: 1 },
        { status: 'PENDING', _count: 2 },
      ])

      const res = await app.inject({
        method: 'GET',
        url: '/newsletter/subscribers',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toHaveLength(1)
      expect(body.meta.hasMore).toBe(false)
      expect(body.counts).toEqual({ total: 3, confirmed: 1, pending: 2, unsubscribed: 0 })
    })
  })

  // ── POST /newsletter/send (admin) ──────────────────────────────────────────

  describe('POST /newsletter/send', () => {
    it('returns 401 without authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/newsletter/send',
        payload: { subject: 'Test', content: '<p>Hello</p>' },
      })

      expect(res.statusCode).toBe(401)
    })

    it('returns 403 for non-admin users', async () => {
      const token = generateTestToken(app, { role: 'user' })

      const res = await app.inject({
        method: 'POST',
        url: '/newsletter/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { subject: 'Test', content: '<p>Hello</p>' },
      })

      expect(res.statusCode).toBe(403)
    })

    it('sends newsletter to confirmed subscribers', async () => {
      const token = generateAdminToken(app)

      mockPrisma.newsletter.findMany.mockResolvedValue([
        { id: 'sub-a', email: 'a@example.com' },
        { id: 'sub-b', email: 'b@example.com' },
      ])

      const res = await app.inject({
        method: 'POST',
        url: '/newsletter/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { subject: 'New Post!', content: '<p>Check it out</p>' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().sent).toBe(2)
    })

    it('handles no subscribers gracefully', async () => {
      const token = generateAdminToken(app)
      mockPrisma.newsletter.findMany.mockResolvedValue([])

      const res = await app.inject({
        method: 'POST',
        url: '/newsletter/send',
        headers: { authorization: `Bearer ${token}` },
        payload: { subject: 'Test', content: '<p>Hello</p>' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().sent).toBe(0)
    })
  })
})
