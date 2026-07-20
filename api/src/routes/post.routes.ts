import { FastifyInstance } from 'fastify'
import { postController } from '../controllers/post.controller'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

export async function postRoutes(app: FastifyInstance) {
  // ── Public routes ────────────────────────────────────────────────────────────

  // GET /posts
  app.get('/', postController.list)

  // GET /posts/:slug
  app.get('/:slug', postController.getBySlug)

  // ── Admin routes (JWT + admin role required) ─────────────────────────────────

  // GET /posts/admin — all posts, any status (drafts included)
  app.get('/admin', { preHandler: [authenticate, authorize('admin')] }, postController.listAll)

  // GET /posts/admin/:id
  app.get('/admin/:id', { preHandler: [authenticate, authorize('admin')] }, postController.getById)

  // POST /posts
  app.post('/', { preHandler: [authenticate, authorize('admin')] }, postController.create)

  // PUT /posts/:id
  app.put('/:id', { preHandler: [authenticate, authorize('admin')] }, postController.update)

  // DELETE /posts/:id
  app.delete('/:id', { preHandler: [authenticate, authorize('admin')] }, postController.remove)

  // PATCH /posts/:id/publish
  app.patch('/:id/publish', { preHandler: [authenticate, authorize('admin')] }, postController.publish)
}
