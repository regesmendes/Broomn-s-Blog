import { FastifyRequest, FastifyReply } from 'fastify'
import { supportService } from '../services/support.service'
import { updateSupportSchema } from '../schemas/support.schema'

export const supportController = {
  // ── GET /support (public) ────────────────────────────────────────────────────
  async get(request: FastifyRequest, reply: FastifyReply) {
    const support = await supportService.get()

    if (!support) {
      return reply.status(404).send({ error: 'Support page not found' })
    }

    return reply.send(support)
  },

  // ── PUT /support (admin) ─────────────────────────────────────────────────────
  async update(request: FastifyRequest, reply: FastifyReply) {
    const { content } = updateSupportSchema.parse(request.body)
    const support = await supportService.update(content)

    if (!support) {
      return reply.status(404).send({ error: 'Support page not found' })
    }

    return reply.send(support)
  },
}
