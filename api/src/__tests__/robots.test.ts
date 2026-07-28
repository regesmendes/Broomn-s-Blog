import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestApp } from './helpers'
import { FastifyInstance } from 'fastify'

describe('API host is never indexed', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('sends X-Robots-Tag: noindex, nofollow on every response', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow')
  })

  it('sends X-Robots-Tag even on a 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/no-such-route' })

    expect(res.statusCode).toBe(404)
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow')
  })

  it('serves a disallow-all robots.txt', async () => {
    const res = await app.inject({ method: 'GET', url: '/robots.txt' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/plain')
    expect(res.body).toBe('User-agent: *\nDisallow: /\n')
  })
})
