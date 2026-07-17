import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middlewares/authenticate'
import { authorize } from '../middlewares/authorize'

const UPLOADS_DIR = join(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function mediaRoutes(app: FastifyInstance) {
  // Ensure uploads directory exists
  if (!existsSync(UPLOADS_DIR)) {
    await mkdir(UPLOADS_DIR, { recursive: true })
  }

  // ── POST /media/upload ─────────────────────────────────────────────────────
  app.post('/upload', { preHandler: [authenticate, authorize('admin')] }, async (request, reply) => {
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
    const filepath = join(UPLOADS_DIR, filename)

    // Save to disk
    await writeFile(filepath, buffer)

    // Build public URL
    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`
    const url = `${baseUrl}/media/files/${filename}`

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
    const { page = '1', limit = '10', search = '' } = request.query as {
      page?: string
      limit?: string
      search?: string
    }

    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))

    const where = search
      ? { originalName: { contains: search, mode: 'insensitive' as const } }
      : {}

    const [total, media] = await prisma.$transaction([
      prisma.media.count({ where }),
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          _count: { select: { posts: true } },
        },
      }),
    ])

    const result = media.map((m) => ({
      ...m,
      usageCount: m._count.posts,
      _count: undefined,
    }))

    return reply.send({
      data: result,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
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

    // Delete file from disk
    const filepath = join(UPLOADS_DIR, media.filename)
    try {
      await unlink(filepath)
    } catch {
      // File might already be gone — continue
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

  // ── GET /media/files/:filename (serve uploaded files) ──────────────────────
  app.get('/files/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string }
    const filepath = join(UPLOADS_DIR, filename)

    if (!existsSync(filepath)) {
      return reply.status(404).send({ error: 'File not found' })
    }

    const { readFile } = await import('fs/promises')
    const buffer = await readFile(filepath)

    // Determine content type from extension
    const ext = extname(filename).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    }

    const contentType = mimeMap[ext] || 'application/octet-stream'
    return reply
      .header('Content-Type', contentType)
      .header('Cross-Origin-Resource-Policy', 'cross-origin')
      .send(buffer)
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
