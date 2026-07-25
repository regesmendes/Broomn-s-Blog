import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createTestApp, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'

const mockPrisma = prisma as unknown as {
  post: { [k: string]: ReturnType<typeof vi.fn> }
  user: { [k: string]: ReturnType<typeof vi.fn> }
  pageView: { [k: string]: ReturnType<typeof vi.fn> }
  requestLog: { [k: string]: ReturnType<typeof vi.fn> }
}

const SESSION_ID = 'c56a4180-65aa-42ec-a945-5fd21dec0538'

describe('Request logging (onSend hook)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('does not log requests without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    expect(mockPrisma.requestLog.create).not.toHaveBeenCalled()
  })

  it('logs a token-carrying request with the route pattern, not the resolved URL', async () => {
    mockPrisma.requestLog.create.mockResolvedValue({})
    mockPrisma.post.findFirst.mockResolvedValue(null)
    const token = generateTestToken(app, { sub: 'user-1' })

    // A public route: request.user is still set because the rate limiter's
    // keyGenerator jwtVerify()s any token it finds
    const res = await app.inject({
      method: 'GET',
      url: '/posts/some-slug',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
    expect(mockPrisma.requestLog.create).toHaveBeenCalledTimes(1)
    const arg = mockPrisma.requestLog.create.mock.calls[0][0]
    expect(arg.data.userId).toBe('user-1')
    expect(arg.data.method).toBe('GET')
    expect(arg.data.path).toBe('/posts/:slug')
    expect(arg.data.statusCode).toBe(404)
    expect(arg.data.durationMs).toBeTypeOf('number')
  })

  it('does not log the same request twice for authenticated routes', async () => {
    mockPrisma.requestLog.create.mockResolvedValue({})
    const token = generateTestToken(app, { sub: 'user-1' })

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBeLessThan(500)
    expect(mockPrisma.requestLog.create).toHaveBeenCalledTimes(1)
  })

  it('never logs the admin analytics reads (analytics must not observe itself)', async () => {
    mockPrisma.requestLog.create.mockResolvedValue({})
    mockPrisma.requestLog.groupBy.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
    const token = generateTestToken(app, { sub: 'admin-1', role: 'admin' })

    const res = await app.inject({
      method: 'GET',
      url: '/analytics/requests/by-user',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(mockPrisma.requestLog.create).not.toHaveBeenCalled()
  })

  it('never logs /analytics/pageview (tracking must not log itself)', async () => {
    mockPrisma.pageView.create.mockResolvedValue({})
    const token = generateTestToken(app, { sub: 'user-1' })

    const res = await app.inject({
      method: 'POST',
      url: '/analytics/pageview',
      headers: { authorization: `Bearer ${token}` },
      payload: { path: '/posts/hello', sessionId: SESSION_ID, durationMs: 5000 },
    })

    expect(res.statusCode).toBe(204)
    expect(mockPrisma.pageView.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.requestLog.create).not.toHaveBeenCalled()
  })

  it('still sends the response when the log write fails', async () => {
    mockPrisma.requestLog.create.mockRejectedValue(new Error('db down'))
    const token = generateTestToken(app, { sub: 'user-1' })

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
