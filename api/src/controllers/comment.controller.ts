import { FastifyRequest, FastifyReply } from 'fastify'
import { commentService } from '../services/comment.service'
import {
  listCommentsQuerySchema,
  commentPostParamSchema,
  commentIdParamSchema,
  createCommentSchema,
  approveCommentSchema,
} from '../schemas/comment.schema'

export const commentController = {
  // ── GET /posts/:postId/comments (public — only approved) ─────────────────────
  async listApproved(request: FastifyRequest, reply: FastifyReply) {
    const { postId } = commentPostParamSchema.parse(request.params)
    const query = listCommentsQuerySchema.parse(request.query)
    const result = await commentService.listApproved(postId, query)
    return reply.send(result)
  },

  // ── GET /posts/:postId/comments/all (admin — includes unapproved) ────────────
  async listAll(request: FastifyRequest, reply: FastifyReply) {
    const { postId } = commentPostParamSchema.parse(request.params)
    const query = listCommentsQuerySchema.parse(request.query)
    const result = await commentService.listAll(postId, query)
    return reply.send(result)
  },

  // ── GET /comments/admin (admin — all comments across all posts) ──────────────
  async listAllGlobal(request: FastifyRequest, reply: FastifyReply) {
    const query = listCommentsQuerySchema.parse(request.query)
    const result = await commentService.listAllGlobal(query)
    return reply.send(result)
  },

  // ── POST /posts/:postId/comments (auth required) ─────────────────────────────
  async create(request: FastifyRequest, reply: FastifyReply) {
    const { postId } = commentPostParamSchema.parse(request.params)
    const { content } = createCommentSchema.parse(request.body)
    const userId = request.user.sub

    const comment = await commentService.create(postId, userId, content)
    return reply.status(201).send(comment)
  },

  // ── PATCH /comments/:id/approve (admin only) ─────────────────────────────────
  async approve(request: FastifyRequest, reply: FastifyReply) {
    const { id } = commentIdParamSchema.parse(request.params)
    const { approved } = approveCommentSchema.parse(request.body)

    const comment = await commentService.setApproval(id, approved)

    if (!comment) {
      return reply.status(404).send({ error: 'Comment not found' })
    }

    return reply.send(comment)
  },

  // ── DELETE /comments/:id (owner or admin) ────────────────────────────────────
  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = commentIdParamSchema.parse(request.params)
    const userId = request.user.sub
    const isAdmin = request.user.role === 'admin'

    const result = await commentService.delete(id, userId, isAdmin)

    if (result === null) {
      return reply.status(404).send({ error: 'Comment not found' })
    }

    if (result === 'forbidden') {
      return reply.status(403).send({ error: 'You can only delete your own comments' })
    }

    return reply.status(204).send()
  },
}
