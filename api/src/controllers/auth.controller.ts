import { FastifyRequest, FastifyReply } from 'fastify'
import { authService } from '../services/auth.service'
import { googleAuthSchema, refreshTokenSchema } from '../schemas/auth.schema'

export const authController = {
  // ── POST /auth/google ────────────────────────────────────────────────────────
  async loginWithGoogle(request: FastifyRequest, reply: FastifyReply) {
    const { idToken } = googleAuthSchema.parse(request.body)

    try {
      const result = await authService.loginWithGoogle(idToken, request.server)
      return reply.send(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      return reply.status(401).send({ error: message })
    }
  },

  // ── POST /auth/refresh ───────────────────────────────────────────────────────
  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = refreshTokenSchema.parse(request.body)

    const result = await authService.refresh(refreshToken, request.server)

    if (!result) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' })
    }

    return reply.send(result)
  },

  // ── GET /auth/me ─────────────────────────────────────────────────────────────
  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await authService.me(request.user.sub)

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return reply.send(user)
  },
}
