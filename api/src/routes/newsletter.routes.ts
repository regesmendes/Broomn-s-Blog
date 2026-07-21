import { FastifyInstance } from 'fastify'
import { newsletterController } from '../controllers/newsletter.controller'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

export async function newsletterRoutes(app: FastifyInstance) {
  // ── Public ───────────────────────────────────────────────────────────────────

  // POST /newsletter/subscribe — tightened beyond the global default: public,
  // unauthenticated, and a prime spam target that costs real SES sends.
  app.post(
    '/subscribe',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    newsletterController.subscribe
  )

  // GET /newsletter/confirm?token=xxx
  app.get('/confirm', newsletterController.confirm)

  // GET /newsletter/unsubscribe?token=xxx
  app.get('/unsubscribe', newsletterController.confirm_unsubscribe)

  // ── Admin ────────────────────────────────────────────────────────────────────

  // GET /newsletter/subscribers
  app.get('/subscribers', { preHandler: [authenticate, authorize('admin')] }, newsletterController.listSubscribers)

  // POST /newsletter/subscribers/:id/unsubscribe — admin manually unsubscribes someone
  app.post(
    '/subscribers/:id/unsubscribe',
    { preHandler: [authenticate, authorize('admin')] },
    newsletterController.adminUnsubscribe
  )

  // PATCH /newsletter/subscribers/:id/block
  app.patch(
    '/subscribers/:id/block',
    { preHandler: [authenticate, authorize('admin')] },
    newsletterController.block
  )

  // PATCH /newsletter/subscribers/:id/unblock
  app.patch(
    '/subscribers/:id/unblock',
    { preHandler: [authenticate, authorize('admin')] },
    newsletterController.unblock
  )

  // POST /newsletter/send
  app.post('/send', { preHandler: [authenticate, authorize('admin')] }, newsletterController.send)
}
