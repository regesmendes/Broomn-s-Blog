import { FastifyInstance } from 'fastify'
import { newsletterController } from '../controllers/newsletter.controller'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

export async function newsletterRoutes(app: FastifyInstance) {
  // ── Public ───────────────────────────────────────────────────────────────────

  // POST /newsletter/subscribe
  app.post('/subscribe', newsletterController.subscribe)

  // GET /newsletter/confirm?token=xxx
  app.get('/confirm', newsletterController.confirm)

  // GET /newsletter/unsubscribe?token=xxx
  app.get('/unsubscribe', newsletterController.confirm_unsubscribe)

  // ── Admin ────────────────────────────────────────────────────────────────────

  // GET /newsletter/subscribers
  app.get('/subscribers', { preHandler: [authenticate, authorize('admin')] }, newsletterController.listSubscribers)

  // POST /newsletter/send
  app.post('/send', { preHandler: [authenticate, authorize('admin')] }, newsletterController.send)
}
