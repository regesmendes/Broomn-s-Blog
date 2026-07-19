import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { uploadObject, deleteObject } from '../lib/s3'
import { paginateWithCursor } from '../lib/pagination'
import { cursorQuerySchema } from '../schemas/pagination.schema'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

const listMediaQuerySchema = cursorQuerySchema(10).extend({
  search: z.string().optional(),
})

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function mediaRoutes(app: FastifyInstance) {
  // ── POST /media/upload ─────────────────────────────────────────────────────
  // Tightened beyond the global default, keyed per-user, to bound storage
  // costs while still allowing legitimate multi-file drag-drop uploads.
  app.post('/upload', {
    preHandler: [authenticate, authorize('admin')],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const data = await request.file()

    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' })
    }

    if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({
        error: `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      })
    }

    // Read the file buffer
    const buffer = await data.toBuffer()

    if (buffer.length > MAX_FILE_SIZE) {
      return reply.status(400).send({ error: 'File too large. Maximum size is 5MB.' })
    }

    // Generate unique filename
    const ext = extname(data.filename) || mimeToExt(data.mimetype)
    const filename = `${randomUUID()}${ext}`

    // Upload to S3 — this is the public URL used to serve the image
    const url = await uploadObject(filename, buffer, data.mimetype)

    // Save to database
    const media = await prisma.media.create({
      data: {
        filename,
        originalName: data.filename,
        mimeType: data.mimetype,
        size: buffer.length,
        url,
      },
    })

    return reply.status(201).send(media)
  })

  // ── GET /media ─────────────────────────────────────────────────────────────
  app.get('/', { preHandler: [authenticate, authorize('admin')] }, async (request, reply) => {
    const { cursor, limit, search } = listMediaQuerySchema.parse(request.query)

    const where = search
      ? { originalName: { contains: search, mode: 'insensitive' as const } }
      : {}

    const result = await paginateWithCursor(
      (args) =>
        prisma.media.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            _count: { select: { posts: true } },
          },
          ...args,
        }),
      { cursor, limit }
    )

    return reply.send({
      ...result,
      data: result.data.map((m) => ({
        ...m,
        usageCount: m._count.posts,
        _count: undefined,
      })),
    })
  })

  // ── GET /media/:id ─────────────────────────────────────────────────────────
  app.get('/:id', { preHandler: [authenticate, authorize('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        posts: {
          include: {
            post: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    })

    if (!media) {
      return reply.status(404).send({ error: 'Media not found' })
    }

    return reply.send({
      ...media,
      posts: media.posts.map((mp) => mp.post),
    })
  })

  // ── DELETE /media/:id ──────────────────────────────────────────────────────
  app.delete('/:id', { preHandler: [authenticate, authorize('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const media = await prisma.media.findUnique({
      where: { id },
      include: { _count: { select: { posts: true } } },
    })

    if (!media) {
      return reply.status(404).send({ error: 'Media not found' })
    }

    // Delete object from S3
    try {
      await deleteObject(media.filename)
    } catch {
      // Object might already be gone — continue
    }

    // Delete from database (cascade removes MediaOnPosts)
    await prisma.media.delete({ where: { id } })

    return reply.status(204).send()
  })

  // ── PATCH /media/:id/replace ───────────────────────────────────────────────
  // Replace all occurrences of this image's URL in posts with a new URL
  app.patch('/:id/replace', { preHandler: [authenticate, authorize('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { newUrl } = request.body as { newUrl: string }

    if (!newUrl) {
      return reply.status(400).send({ error: 'newUrl is required' })
    }

    const media = await prisma.media.findUnique({
      where: { id },
      include: {
        posts: { include: { post: true } },
      },
    })

    if (!media) {
      return reply.status(404).send({ error: 'Media not found' })
    }

    // Update all posts that use this image
    const updates = media.posts.map((mp) => {
      const updatedContent = mp.post.content.replace(
        new RegExp(escapeRegex(media.url), 'g'),
        newUrl
      )
      return prisma.post.update({
        where: { id: mp.post.id },
        data: { content: updatedContent },
      })
    })

    await Promise.all(updates)

    return reply.send({
      message: `Replaced in ${updates.length} post(s)`,
      postsUpdated: updates.length,
    })
  })
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  }
  return map[mime] || '.bin'
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
