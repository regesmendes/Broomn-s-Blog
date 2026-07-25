import { FastifyRequest, FastifyReply } from 'fastify'
import { analyticsService } from '../services/analytics.service'
import {
  trackPageViewSchema,
  summaryQuerySchema,
  requestsByUserQuerySchema,
  userSessionsQuerySchema,
} from '../schemas/analytics.schema'

export const analyticsController = {
  // ── POST /analytics/pageview (any authenticated user) ────────────────────────
  async trackPageView(request: FastifyRequest, reply: FastifyReply) {
    const data = trackPageViewSchema.parse(request.body)

    // userId always comes from the verified token, never the body
    await analyticsService.trackPageView({ userId: request.user.sub, ...data })

    return reply.status(204).send()
  },

  // ── GET /analytics/summary (admin) ───────────────────────────────────────────
  async getSummary(request: FastifyRequest, reply: FastifyReply) {
    const { from, to } = summaryQuerySchema.parse(request.query)
    return reply.send(await analyticsService.getSummary(from, to))
  },

  // ── GET /analytics/requests/by-user (admin) ──────────────────────────────────
  async getRequestsByUser(request: FastifyRequest, reply: FastifyReply) {
    const { from, to, limit } = requestsByUserQuerySchema.parse(request.query)
    return reply.send(await analyticsService.getRequestsByUser(from, to, limit))
  },

  // ── GET /analytics/users/:userId/sessions (admin) ────────────────────────────
  async getUserSessions(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string }
    const { from, to, limit } = userSessionsQuerySchema.parse(request.query)

    const result = await analyticsService.getSessionsForUser(userId, from, to, limit)

    if (!result) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return reply.send(result)
  },

  // ── GET /analytics/users/:userId/sessions/:sessionId (admin) ─────────────────
  async getSessionJourney(request: FastifyRequest, reply: FastifyReply) {
    const { userId, sessionId } = request.params as { userId: string; sessionId: string }

    const result = await analyticsService.getSessionJourney(userId, sessionId)

    if (!result) {
      return reply.status(404).send({ error: 'Session not found' })
    }

    return reply.send(result)
  },
}
