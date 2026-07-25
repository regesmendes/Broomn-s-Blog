import { FastifyInstance } from 'fastify'
import { analyticsController } from '../controllers/analytics.controller'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

export async function analyticsRoutes(app: FastifyInstance) {
  // POST /analytics/pageview — any logged-in user, not admin-gated. Tighter
  // per-user rate limit than the global default: it's fired by a background
  // tracker, never user-visible, so a low ceiling costs nothing.
  app.post('/pageview', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, analyticsController.trackPageView)

  // Admin read endpoints
  app.get('/summary', { preHandler: [authenticate, authorize('admin')] }, analyticsController.getSummary)
  app.get('/requests/by-user', { preHandler: [authenticate, authorize('admin')] }, analyticsController.getRequestsByUser)
  app.get('/users/:userId/sessions', { preHandler: [authenticate, authorize('admin')] }, analyticsController.getUserSessions)
  app.get('/users/:userId/sessions/:sessionId', { preHandler: [authenticate, authorize('admin')] }, analyticsController.getSessionJourney)
}
