import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'
import { postRoutes } from './routes/post.routes'
import { analyticsRoutes } from './routes/analytics.routes'
import { analyticsRepository } from './repositories/analytics.repository'
import { authRoutes } from './routes/auth.routes'
import { commentRoutes } from './routes/comment.routes'
import { newsletterRoutes } from './routes/newsletter.routes'
import { tagRoutes } from './routes/tag.routes'
import { mediaRoutes } from './routes/media.routes'
import { aboutRoutes } from './routes/about.routes'
import { supportRoutes } from './routes/support.routes'
import { devAuthRoutes } from './routes/dev-auth.routes'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      ...(process.env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }),
    },
  })

  // Security
  app.register(helmet, { global: true })

  // This host is a JSON API, never meant to be crawled or indexed — but its
  // own public ACM cert makes api.blogdobroomn.com discoverable via
  // Certificate Transparency logs regardless of whether the site links to it.
  // GSC (a domain property covering every subdomain) flagged it, so every
  // response gets an explicit "don't index this" signal, not just /robots.txt.
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('X-Robots-Tag', 'noindex, nofollow')
  })

  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  })

  // Auth (registered before rate limiting so its `jwtVerify` decorator is
  // available to the rate limit keyGenerator below)
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
  })

  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // Key by authenticated user when possible, so users don't share a quota
    // just for being behind the same IP (offices, NAT, etc) — falls back to
    // IP for anonymous requests. Verifies the token (not just decodes it):
    // trusting an unverified `sub` claim would let anyone dodge the limit by
    // sending a fresh made-up token on every request.
    keyGenerator: async (request) => {
      try {
        await request.jwtVerify()
        return `user:${request.user.sub}`
      } catch {
        return request.ip
      }
    },
  })

  // Request logging for the internal analytics dashboard. Must be onSend, not
  // onResponse: under Lambda, light-my-request's 'finish' listener can resolve
  // the invocation before an async onResponse hook finishes, silently dropping
  // rows — Fastify awaits onSend before the reply goes out. request.user is set
  // by the rate limiter's keyGenerator (jwtVerify on every request), so any
  // request carrying a valid token gets logged, whatever the route.
  app.addHook('onSend', async (request, reply, payload) => {
    if (!request.user?.sub) return payload
    const routePath = request.routeOptions.url
    // Analytics must never observe itself: neither the pageview beacon nor
    // the admin dashboard's own reads belong in the data they produce
    if (routePath?.startsWith('/analytics')) return payload
    // The auto-refresh timer in auth-context.tsx fires silently on a
    // schedule, invisible to the user — not a step in anyone's journey, and
    // not logged at all (no record, not just hidden from display)
    if (routePath === '/auth/refresh') return payload

    try {
      const sessionId = request.headers['x-session-id']
      await analyticsRepository.createRequestLog({
        userId:     request.user.sub,
        // Ties this action to the same per-tab session PageView uses, so the
        // journey endpoint can interleave them — only ever set by the
        // frontend's api client, so absent for Swagger/curl/test callers
        sessionId:  typeof sessionId === 'string' ? sessionId : undefined,
        method:     request.method,
        path:       routePath ?? request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      })
    } catch (err) {
      // Analytics must never break the request it's observing
      app.log.error(err, 'Failed to write RequestLog')
    }
    return payload
  })

  // File uploads
  app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  })

  // API docs (only in non-production)
  if (process.env.NODE_ENV !== 'production') {
    app.register(swagger, {
      openapi: {
        info: {
          title: 'Fora do Programa API',
          description: 'Personal blog REST API',
          version: '1.0.0',
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    })

    app.register(swaggerUi, {
      routePrefix: '/docs',
    })
  }

  // Health check
  app.get('/health', async () => ({ status: 'ok' }))

  // Belt-and-suspenders alongside the X-Robots-Tag header above: well-behaved
  // crawlers check this before requesting anything else on the host at all.
  app.get('/robots.txt', async (_request, reply) => {
    reply.type('text/plain').send('User-agent: *\nDisallow: /\n')
  })

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.register(authRoutes, { prefix: '/auth' })
  app.register(postRoutes, { prefix: '/posts' })
  app.register(tagRoutes, { prefix: '/tags' })
  app.register(mediaRoutes, { prefix: '/media' })
  app.register(commentRoutes)
  app.register(newsletterRoutes, { prefix: '/newsletter' })
  app.register(aboutRoutes, { prefix: '/about' })
  app.register(supportRoutes, { prefix: '/support' })
  app.register(analyticsRoutes, { prefix: '/analytics' })

  // Dev-only routes (never available in production)
  if (process.env.NODE_ENV !== 'production') {
    app.register(devAuthRoutes, { prefix: '/auth' })
  }

  // ── Global error handler ───────────────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const err = error as {
      validation?: unknown
      statusCode?: number
      message?: string
      issues?: unknown[]  // ZodError
      name?: string
    }

    // Fastify native validation errors
    if (err.validation) {
      return reply.status(400).send({
        error: 'Validation error',
        details: err.validation,
      })
    }

    // Zod validation errors
    if (err.name === 'ZodError' && err.issues) {
      return reply.status(400).send({
        error: 'Validation error',
        details: err.issues,
      })
    }

    app.log.error(error)
    reply.status(err.statusCode ?? 500).send({
      error: err.message ?? 'Internal server error',
    })
  })

  return app
}
