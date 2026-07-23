import { FastifyInstance } from 'fastify'
import { supportController } from '../controllers/support.controller'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

export async function supportRoutes(app: FastifyInstance) {
  // GET /support — public
  app.get('/', supportController.get)

  // PUT /support — admin only
  app.put('/', { preHandler: [authenticate, authorize('admin')] }, supportController.update)
}
