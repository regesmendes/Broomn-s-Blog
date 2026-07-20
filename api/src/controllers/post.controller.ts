import { FastifyRequest, FastifyReply } from 'fastify'
import { postService } from '../services/post.service'
import {
  listPostsQuerySchema,
  listAllPostsQuerySchema,
  postSlugParamSchema,
  postIdParamSchema,
  createPostSchema,
  updatePostSchema,
  publishPostSchema,
} from '../schemas/post.schema'

export const postController = {
  // ── GET /posts ───────────────────────────────────────────────────────────────
  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listPostsQuerySchema.parse(request.query)
    const result = await postService.listPublished(query)
    return reply.send(result)
  },

  // ── GET /posts/:slug ─────────────────────────────────────────────────────────
  async getBySlug(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = postSlugParamSchema.parse(request.params)
    const post = await postService.getPublishedBySlug(slug)

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' })
    }

    return reply.send(post)
  },

  // ── GET /admin/posts (admin — all posts, any status) ─────────────────────────
  async listAll(request: FastifyRequest, reply: FastifyReply) {
    const query = listAllPostsQuerySchema.parse(request.query)
    const result = await postService.listAll(query)
    return reply.send(result)
  },

  // ── GET /admin/posts/:id ─────────────────────────────────────────────────────
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = postIdParamSchema.parse(request.params)
    const post = await postService.getById(id)

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' })
    }

    return reply.send(post)
  },

  // ── POST /admin/posts ────────────────────────────────────────────────────────
  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createPostSchema.parse(request.body)
    const post = await postService.create(body)
    return reply.status(201).send(post)
  },

  // ── PUT /admin/posts/:id ─────────────────────────────────────────────────────
  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = postIdParamSchema.parse(request.params)
    const body = updatePostSchema.parse(request.body)

    const post = await postService.update(id, body)

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' })
    }

    return reply.send(post)
  },

  // ── DELETE /admin/posts/:id ──────────────────────────────────────────────────
  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = postIdParamSchema.parse(request.params)
    const deleted = await postService.delete(id)

    if (!deleted) {
      return reply.status(404).send({ error: 'Post not found' })
    }

    return reply.status(204).send()
  },

  // ── PATCH /admin/posts/:id/publish ───────────────────────────────────────────
  async publish(request: FastifyRequest, reply: FastifyReply) {
    const { id } = postIdParamSchema.parse(request.params)
    const body = publishPostSchema.parse(request.body)

    const post = await postService.setPublishState(id, body)

    if (!post) {
      return reply.status(404).send({ error: 'Post not found' })
    }

    return reply.send(post)
  },
}
