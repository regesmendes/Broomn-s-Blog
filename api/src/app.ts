import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'
import { postRoutes } from './routes/post.routes'
import { authRoutes } from './routes/auth.routes'
import { commentRoutes } from './routes/comment.routes'
import { newsletterRoutes } from './routes/newsletter.routes'
import { tagRoutes } from './routes/tag.routes'
import { mediaRoutes } from './routes/media.routes'
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

  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  // File uploads
  app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  })

  // Auth
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
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

  // ── Routes ─────────────────────────────────────────────────────────────────
  app.register(authRoutes, { prefix: '/auth' })
  app.register(postRoutes, { prefix: '/posts' })
  app.register(tagRoutes, { prefix: '/tags' })
  app.register(mediaRoutes, { prefix: '/media' })
  app.register(commentRoutes)
  app.register(newsletterRoutes, { prefix: '/newsletter' })

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
