import { FastifyInstance } from 'fastify'
import { authController } from '../controllers/auth.controller'
import { authenticate } from '../middlewares/authenticate'

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/google  — exchange Cognito ID token for our JWT
  app.post('/google', authController.loginWithGoogle)

  // POST /auth/refresh — get a new access token using a refresh token
  app.post('/refresh', authController.refresh)

  // GET /auth/me — return the authenticated user's profile
  app.get('/me', { preHandler: authenticate }, authController.me)
}
