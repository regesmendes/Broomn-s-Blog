import { FastifyRequest, FastifyReply } from 'fastify'
import { aboutService } from '../services/about.service'
import { updateAboutSchema } from '../schemas/about.schema'

export const aboutController = {
  // ── GET /about (public) ──────────────────────────────────────────────────────
  async get(request: FastifyRequest, reply: FastifyReply) {
    const about = await aboutService.get()

    if (!about) {
      return reply.status(404).send({ error: 'About page not found' })
    }

    return reply.send(about)
  },

  // ── PUT /about (admin) ───────────────────────────────────────────────────────
  async update(request: FastifyRequest, reply: FastifyReply) {
    const { content } = updateAboutSchema.parse(request.body)
    const about = await aboutService.update(content)

    if (!about) {
      return reply.status(404).send({ error: 'About page not found' })
    }

    return reply.send(about)
  },
}
