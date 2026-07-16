import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { JwtPayload } from '../types'

const devLoginSchema = z.object({
  email: z.string().email(),
})

/**
 * Dev-only auth route. Allows logging in as any seeded user without Cognito.
 * This route only registers when NODE_ENV !== 'production'.
 */
export async function devAuthRoutes(app: FastifyInstance) {
  // POST /auth/dev-login
  app.post('/dev-login', async (request, reply) => {
    const { email } = devLoginSchema.parse(request.body)

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return reply.status(404).send({
        error: `User not found. Run "npm run db:seed" first to create dev users.`,
      })
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role === 'ADMIN' ? 'admin' : 'user',
    }

    const accessToken = app.jwt.sign(payload, { expiresIn: '24h' })
    const refreshToken = app.jwt.sign(
      { sub: user.id, type: 'refresh' } as unknown as JwtPayload,
      { expiresIn: '7d' }
    )

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    })
  })
}
