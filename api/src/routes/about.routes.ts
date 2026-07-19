import { FastifyInstance } from 'fastify'
import { aboutController } from '../controllers/about.controller'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

export async function aboutRoutes(app: FastifyInstance) {
  // GET /about — public
  app.get('/', aboutController.get)

  // PUT /about — admin only
  app.put('/', { preHandler: [authenticate, authorize('admin')] }, aboutController.update)
}
