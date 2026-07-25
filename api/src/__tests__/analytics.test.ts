import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createTestApp, generateAdminToken, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'

const mockPrisma = prisma as unknown as {
  user: { [k: string]: ReturnType<typeof vi.fn> }
  newsletter: { [k: string]: ReturnType<typeof vi.fn> }
  requestLog: { [k: string]: ReturnType<typeof vi.fn> }
  pageView: { [k: string]: ReturnType<typeof vi.fn> }
}

const SESSION_ID = 'c56a4180-65aa-42ec-a945-5fd21dec0538'

describe('Analytics API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  // ── POST /analytics/pageview ───────────────────────────────────────────────

  describe('POST /analytics/pageview', () => {
    const validPayload = { path: '/posts/some-slug', sessionId: SESSION_ID, durationMs: 12000 }

    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/analytics/pageview',
        payload: validPayload,
      })

      expect(res.statusCode).toBe(401)
      expect(mockPrisma.pageView.create).not.toHaveBeenCalled()
    })

    it('records a page view for the token user, ignoring any userId in the body', async () => {
      mockPrisma.pageView.create.mockResolvedValue({})
      const token = generateTestToken(app, { sub: 'user-1' })

      const res = await app.inject({
        method: 'POST',
        url: '/analytics/pageview',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validPayload, userId: 'someone-else' },
      })

      expect(res.statusCode).toBe(204)
      expect(mockPrisma.pageView.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          path: '/posts/some-slug',
          sessionId: SESSION_ID,
          durationMs: 12000,
        },
      })
    })

    it('silently drops analytics-dashboard paths instead of recording them', async () => {
      const token = generateTestToken(app, { sub: 'user-1' })

      const res = await app.inject({
        method: 'POST',
        url: '/analytics/pageview',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validPayload, path: '/admin/analytics/users/user-2' },
      })

      expect(res.statusCode).toBe(204)
      expect(mockPrisma.pageView.create).not.toHaveBeenCalled()
    })

    it('rejects a non-uuid sessionId', async () => {
      const token = generateTestToken(app)

      const res = await app.inject({
        method: 'POST',
        url: '/analytics/pageview',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validPayload, sessionId: 'not-a-uuid' },
      })

      expect(res.statusCode).toBe(400)
    })

    it('rejects a durationMs above the 6h cap', async () => {
      const token = generateTestToken(app)

      const res = await app.inject({
        method: 'POST',
        url: '/analytics/pageview',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validPayload, durationMs: 7 * 60 * 60 * 1000 },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  // ── GET /analytics/summary ─────────────────────────────────────────────────

  describe('GET /analytics/summary', () => {
    it('rejects non-admin users', async () => {
      const token = generateTestToken(app)

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/summary',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns user, request, and newsletter counts', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(42) // countAll
        .mockResolvedValueOnce(5)  // countCreatedBetween
      mockPrisma.requestLog.count.mockResolvedValue(1234)
      mockPrisma.newsletter.count
        .mockResolvedValueOnce(30) // subscribed
        .mockResolvedValueOnce(8)  // unsubscribed
        .mockResolvedValueOnce(2)  // blocked
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/summary?from=2026-06-01&to=2026-07-01',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.users).toEqual({ totalAllTime: 42, newInPeriod: 5 })
      expect(body.requests).toEqual({ totalInPeriod: 1234 })
      expect(body.newsletter).toEqual({ subscribed: 30, unsubscribed: 8, blocked: 2 })
      expect(body.period.from).toBe(new Date('2026-06-01').toISOString())
      expect(body.period.to).toBe(new Date('2026-07-01').toISOString())
    })

    it('rejects an invalid date', async () => {
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/summary?from=banana',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  // ── GET /analytics/requests/by-user ────────────────────────────────────────

  describe('GET /analytics/requests/by-user', () => {
    it('rejects non-admin users', async () => {
      const token = generateTestToken(app)

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/requests/by-user',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(403)
    })

    it('returns per-user counts joined with user info', async () => {
      mockPrisma.requestLog.groupBy.mockResolvedValue([
        { userId: 'user-1', _count: { _all: 100 } },
        { userId: 'user-2', _count: { _all: 60 } },
      ])
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', email: 'a@example.com', name: 'Alice' },
        { id: 'user-2', email: 'b@example.com', name: 'Bob' },
      ])
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/requests/by-user',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json().data).toEqual([
        { userId: 'user-1', email: 'a@example.com', name: 'Alice', requests: 100 },
        { userId: 'user-2', email: 'b@example.com', name: 'Bob', requests: 60 },
      ])
    })

    it('clamps limit to the 1–200 range', async () => {
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/requests/by-user?limit=500',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  // ── GET /analytics/users/:userId/sessions ──────────────────────────────────

  describe('GET /analytics/users/:userId/sessions', () => {
    it('404s for an unknown user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/users/nope/sessions',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

    it('lists sessions with page counts and first/last seen', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@example.com',
        name: 'Alice',
      })
      const first = new Date('2026-07-01T10:00:00Z')
      const last = new Date('2026-07-01T10:30:00Z')
      mockPrisma.pageView.groupBy.mockResolvedValue([
        { sessionId: SESSION_ID, _count: { _all: 7 }, _min: { createdAt: first }, _max: { createdAt: last } },
      ])
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/users/user-1/sessions',
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.user).toEqual({ id: 'user-1', email: 'a@example.com', name: 'Alice' })
      expect(body.data).toEqual([
        {
          sessionId: SESSION_ID,
          pages: 7,
          firstSeen: first.toISOString(),
          lastSeen: last.toISOString(),
        },
      ])
    })
  })

  // ── GET /analytics/users/:userId/sessions/:sessionId ───────────────────────

  describe('GET /analytics/users/:userId/sessions/:sessionId', () => {
    it('404s when the session has neither page views nor logged actions', async () => {
      mockPrisma.pageView.findMany.mockResolvedValue([])
      mockPrisma.requestLog.findMany.mockResolvedValue([])
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'GET',
        url: `/analytics/users/user-1/sessions/${SESSION_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(404)
    })

    it('returns page views with computed enteredAt', async () => {
      const leftAt = new Date('2026-07-01T10:05:00Z')
      mockPrisma.pageView.findMany.mockResolvedValue([
        {
          id: 'pv-1',
          userId: 'user-1',
          sessionId: SESSION_ID,
          path: '/posts/hello',
          durationMs: 60_000,
          createdAt: leftAt,
        },
      ])
      mockPrisma.requestLog.findMany.mockResolvedValue([])
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'GET',
        url: `/analytics/users/user-1/sessions/${SESSION_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.sessionId).toBe(SESSION_ID)
      expect(body.steps).toEqual([
        {
          type: 'pageview',
          id: 'pv-1',
          path: '/posts/hello',
          durationMs: 60_000,
          enteredAt: new Date(leftAt.getTime() - 60_000).toISOString(),
          leftAt: leftAt.toISOString(),
        },
      ])
      expect(mockPrisma.pageView.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', sessionId: SESSION_ID },
        orderBy: { createdAt: 'asc' },
      })
    })

    it('interleaves a mid-visit action between the page views around it', async () => {
      // Reading a post (10:00–10:05), commenting at 10:02, then reading the
      // next post (10:05 onward) — the comment must land between the two
      // page steps, not before or after both of them.
      const firstPageLeftAt = new Date('2026-07-01T10:05:00Z') // entered 10:00
      const commentAt = new Date('2026-07-01T10:02:00Z')
      const secondPageLeftAt = new Date('2026-07-01T10:10:00Z') // entered 10:05

      mockPrisma.pageView.findMany.mockResolvedValue([
        {
          id: 'pv-1',
          userId: 'user-1',
          sessionId: SESSION_ID,
          path: '/posts/hello',
          durationMs: 5 * 60_000,
          createdAt: firstPageLeftAt,
        },
        {
          id: 'pv-2',
          userId: 'user-1',
          sessionId: SESSION_ID,
          path: '/posts/next',
          durationMs: 5 * 60_000,
          createdAt: secondPageLeftAt,
        },
      ])
      mockPrisma.requestLog.findMany.mockResolvedValue([
        {
          id: 'req-1',
          userId: 'user-1',
          sessionId: SESSION_ID,
          method: 'POST',
          path: '/posts/:postId/comments',
          statusCode: 201,
          durationMs: 42,
          createdAt: commentAt,
        },
      ])
      const token = generateAdminToken(app)

      const res = await app.inject({
        method: 'GET',
        url: `/analytics/users/user-1/sessions/${SESSION_ID}`,
        headers: { authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.steps.map((s: { type: string; path: string }) => `${s.type}:${s.path}`)).toEqual([
        'pageview:/posts/hello',
        'action:/posts/:postId/comments',
        'pageview:/posts/next',
      ])
      expect(body.steps[1]).toEqual({
        type: 'action',
        id: 'req-1',
        method: 'POST',
        path: '/posts/:postId/comments',
        statusCode: 201,
        durationMs: 42,
        createdAt: commentAt.toISOString(),
      })
      expect(mockPrisma.requestLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', sessionId: SESSION_ID },
        orderBy: { createdAt: 'asc' },
      })
    })
  })
})
