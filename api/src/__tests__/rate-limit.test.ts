import { describe, it, expect } from 'vitest'
import { createTestApp, generateTestToken } from './helpers'
import { prisma } from '../lib/prisma'
import { FastifyInstance } from 'fastify'
import { vi } from 'vitest'

const mockPrisma = prisma as unknown as {
  newsletter: { [k: string]: ReturnType<typeof vi.fn> }
  comment: { [k: string]: ReturnType<typeof vi.fn> }
  post: { [k: string]: ReturnType<typeof vi.fn> }
}

// Each test gets its own fresh app — and therefore its own fresh in-memory
// rate-limit store — so these tests can't pollute each other's quotas or
// those of other test files.

describe('Rate limiting', () => {
  it('blocks the 6th /newsletter/subscribe request from the same IP within the window', async () => {
    const app: FastifyInstance = await createTestApp()
    mockPrisma.newsletter.upsert.mockResolvedValue({
      id: 'sub-1',
      email: 'reader@example.com',
      status: 'PENDING',
      confirmedAt: null,
      createdAt: new Date(),
    })

    const responses = []
    for (let i = 0; i < 6; i++) {
      responses.push(
        await app.inject({
          method: 'POST',
          url: '/newsletter/subscribe',
          payload: { email: 'reader@example.com' },
        })
      )
    }

    const statusCodes = responses.map((r) => r.statusCode)
    expect(statusCodes.slice(0, 5)).toEqual([201, 201, 201, 201, 201])
    expect(statusCodes[5]).toBe(429)

    await app.close()
  })

  it('rate-limits comment creation per-user, not globally — a second user is unaffected', async () => {
    const app: FastifyInstance = await createTestApp()
    mockPrisma.comment.create.mockResolvedValue({
      id: 'c1',
      content: 'hi',
      approved: false,
      createdAt: new Date(),
      user: { id: 'user-a', name: 'A', avatarUrl: null },
    })

    const tokenA = generateTestToken(app, { sub: 'user-a' })
    const tokenB = generateTestToken(app, { sub: 'user-b' })

    // Exhaust user A's quota (max: 10 per minute on this route)
    let lastStatusForA = 0
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/posts/post-1/comments',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { content: 'hi' },
      })
      lastStatusForA = res.statusCode
    }
    expect(lastStatusForA).toBe(429)

    // User B, on the same IP, still gets through — proves the key is the
    // verified JWT subject, not the shared IP.
    const resB = await app.inject({
      method: 'POST',
      url: '/posts/post-1/comments',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { content: 'hi' },
    })
    expect(resB.statusCode).toBe(201)

    await app.close()
  })

  it('falls back to IP-based limiting when no token is present, without erroring', async () => {
    const app: FastifyInstance = await createTestApp()
    mockPrisma.post.findMany.mockResolvedValue([])

    const res = await app.inject({ method: 'GET', url: '/posts' })

    expect(res.statusCode).toBe(200)
    await app.close()
  })
})
