import { FastifyRequest, FastifyReply } from 'fastify'
import { tagService } from '../services/tag.service'
import { tagIdParamSchema, renameTagSchema, listAdminTagsQuerySchema } from '../schemas/tag.schema'

export const tagController = {
  // ── GET /tags ─────────────────────────────────────────────────────────────────
  async list(_request: FastifyRequest, reply: FastifyReply) {
    const tags = await tagService.list()
    return reply.send(tags)
  },

  // ── GET /tags/admin (admin) ──────────────────────────────────────────────────
  async listAdmin(request: FastifyRequest, reply: FastifyReply) {
    const query = listAdminTagsQuerySchema.parse(request.query)
    const result = await tagService.listAdmin(query)
    return reply.send(result)
  },

  // ── PATCH /tags/:id (admin) ──────────────────────────────────────────────────
  async rename(request: FastifyRequest, reply: FastifyReply) {
    const { id } = tagIdParamSchema.parse(request.params)
    const { name } = renameTagSchema.parse(request.body)

    const tag = await tagService.rename(id, name)
    if (!tag) {
      return reply.status(404).send({ error: 'Tag not found' })
    }

    return reply.send(tag)
  },

  // ── DELETE /tags/:id (admin) ─────────────────────────────────────────────────
  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = tagIdParamSchema.parse(request.params)

    const removed = await tagService.remove(id)
    if (!removed) {
      return reply.status(404).send({ error: 'Tag not found' })
    }

    return reply.status(204).send()
  },
}
