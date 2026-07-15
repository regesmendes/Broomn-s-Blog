import { FastifyRequest, FastifyReply } from 'fastify'

/**
 * Returns a preHandler that checks if the authenticated user has one of the allowed roles.
 * Must be used AFTER the `authenticate` middleware.
 *
 * Usage:
 *   { preHandler: [authenticate, authorize('admin')] }
 *   { preHandler: [authenticate, authorize('admin', 'user')] }
 */
export function authorize(...allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!allowedRoles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Forbidden: insufficient permissions' })
    }
  }
}
