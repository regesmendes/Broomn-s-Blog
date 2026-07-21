import { FastifyInstance } from 'fastify'
import { commentController } from '../controllers/comment.controller'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

export async function commentRoutes(app: FastifyInstance) {
  // ── Nested under /posts/:postId/comments ─────────────────────────────────────

  // GET /posts/:postId/comments — public, approved only
  app.get('/posts/:postId/comments', commentController.listApproved)

  // GET /posts/:postId/comments/all — admin, includes unapproved
  app.get('/posts/:postId/comments/all', { preHandler: [authenticate, authorize('admin')] }, commentController.listAll)

  // POST /posts/:postId/comments — auth required (any logged-in user).
  // Tightened beyond the global default, keyed per-user, to stop a single
  // account from flooding a post with comments.
  app.post(
    '/posts/:postId/comments',
    { preHandler: authenticate, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    commentController.create
  )

  // ── Top-level comment actions ────────────────────────────────────────────────

  // GET /comments/admin — list all comments across all posts (admin)
  app.get('/comments/admin', { preHandler: [authenticate, authorize('admin')] }, commentController.listAllGlobal)

  // POST /comments/:id/reply — admin only, reply as Broomn
  app.post('/comments/:id/reply', { preHandler: [authenticate, authorize('admin')] }, commentController.replyAsBroomn)

  // PATCH /comments/:id/approve — admin only
  app.patch('/comments/:id/approve', { preHandler: [authenticate, authorize('admin')] }, commentController.approve)

  // DELETE /comments/:id — owner or admin (logic handled in service)
  app.delete('/comments/:id', { preHandler: authenticate }, commentController.remove)
}
