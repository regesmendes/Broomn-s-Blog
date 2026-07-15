import { buildApp } from '../app'
import { FastifyInstance } from 'fastify'

/**
 * Build a fresh Fastify app instance for testing.
 */
export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp()
  return app
}

/**
 * Generate a valid JWT for testing authenticated routes.
 */
export function generateTestToken(
  app: FastifyInstance,
  payload: { sub?: string; email?: string; role?: 'admin' | 'user' } = {}
): string {
  return app.jwt.sign({
    sub:   payload.sub ?? 'test-user-id',
    email: payload.email ?? 'test@example.com',
    role:  payload.role ?? 'user',
  })
}

/**
 * Generate an admin JWT for testing admin routes.
 */
export function generateAdminToken(app: FastifyInstance): string {
  return generateTestToken(app, {
    sub:   'admin-user-id',
    email: 'admin@example.com',
    role:  'admin',
  })
}
