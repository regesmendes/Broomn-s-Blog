import { FastifyInstance } from 'fastify'
import { tagController } from '../controllers/tag.controller'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

export async function tagRoutes(app: FastifyInstance) {
  // ── Public routes ────────────────────────────────────────────────────────────

  // GET /tags — list all tags with post count (powers the public tag-filter chips)
  app.get('/', tagController.list)

  // ── Admin routes (JWT + admin role required) ─────────────────────────────────

  // GET /tags/admin — paginated, search-filterable listing for the tag management page
  app.get('/admin', { preHandler: [authenticate, authorize('admin')] }, tagController.listAdmin)

  // PATCH /tags/:id — rename, or merge into an existing tag if the new name collides
  app.patch('/:id', { preHandler: [authenticate, authorize('admin')] }, tagController.rename)

  // DELETE /tags/:id
  app.delete('/:id', { preHandler: [authenticate, authorize('admin')] }, tagController.remove)
}
