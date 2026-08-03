import { postRepository } from '../repositories/post.repository'
import { prisma } from '../lib/prisma'
import {
  CreatePostBody,
  UpdatePostBody,
  PublishPostBody,
  ListPostsQuery,
  ListAllPostsQuery,
} from '../schemas/post.schema'

// ─── Service ───────────────────────────────────────────────────────────────────

export const postService = {
  async listPublished(query: ListPostsQuery) {
    const { cursor, limit, tag, search } = query
    const result = await postRepository.findPublished({ cursor, limit, tag, search })

    // Flatten tags from join table shape to a clean array
    return { ...result, data: result.data.map(flattenTags) }
  },

  /** List ALL posts regardless of status (admin) — powers the admin Posts list. */
  async listAll(query: ListAllPostsQuery) {
    const { cursor, limit, status } = query
    const { data, meta, total } = await postRepository.findAll({ cursor, limit, status })
    return { data: data.map(flattenTags), meta: { ...meta, total } }
  },

  async getPublishedBySlug(slug: string) {
    const post = await postRepository.findPublishedBySlug(slug)
    if (!post) return null

    const { previous, next } = await postRepository.findAdjacent({
      id:          post.id,
      publishedAt: post.publishedAt!,
    })

    return { ...flattenTags(post), previousPost: previous, nextPost: next }
  },

  async getById(id: string) {
    const post = await postRepository.findById(id)
    if (!post) return null
    return flattenTags(post)
  },

  async create(body: CreatePostBody) {
    const normalized = normalizeLocaleFields(body)

    if (normalized.status === 'PUBLISHED' && !canPublish(normalized.titleEn, normalized.contentEn)) {
      return 'missing_translation' as const
    }

    const slug = normalized.slug ?? (await generateUniqueSlug(normalized.title))

    const post = flattenTags(await postRepository.create({ ...normalized, slug }))
    await syncMediaUsage(post.id, normalized.content, normalized.contentEn)
    return post
  },

  async update(id: string, body: UpdatePostBody) {
    const existing = await postRepository.findById(id)
    if (!existing) return null

    const normalized = normalizeLocaleFields(body)

    const nextStatus = normalized.status ?? existing.status
    const nextTitleEn = normalized.titleEn !== undefined ? normalized.titleEn : existing.titleEn
    const nextContentEn = normalized.contentEn !== undefined ? normalized.contentEn : existing.contentEn

    if (
      existing.status !== 'PUBLISHED' &&
      nextStatus === 'PUBLISHED' &&
      !canPublish(nextTitleEn, nextContentEn)
    ) {
      return 'missing_translation' as const
    }

    // If title changed and no explicit slug given, regenerate slug
    if (normalized.title && !normalized.slug && normalized.title !== existing.title) {
      normalized.slug = await generateUniqueSlug(normalized.title)
    }

    const post = flattenTags(await postRepository.update(id, normalized))
    if (normalized.content !== undefined || normalized.contentEn !== undefined) {
      await syncMediaUsage(id, post.content, post.contentEn)
    }
    return post
  },

  async delete(id: string) {
    const existing = await postRepository.findById(id)
    if (!existing) return false

    await postRepository.delete(id)
    return true
  },

  async setPublishState(id: string, body: PublishPostBody) {
    const existing = await postRepository.findById(id)
    if (!existing) return null

    if (
      existing.status !== 'PUBLISHED' &&
      body.status === 'PUBLISHED' &&
      !canPublish(existing.titleEn, existing.contentEn)
    ) {
      return 'missing_translation' as const
    }

    return flattenTags(
      await postRepository.updatePublishState(id, body.status, body.publishedAt)
    )
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert Prisma's join-table shape for tags:
 *   tags: [{ tag: { id, name, slug } }]
 * into a flat array:
 *   tags: [{ id, name, slug }]
 */
function flattenTags<T extends { tags?: { tag: unknown }[] }>(post: T) {
  const { tags, ...rest } = post
  return {
    ...rest,
    tags: (tags ?? []).map((t: { tag: unknown }) => t.tag),
  }
}

/**
 * Generate a URL-friendly slug from a title.
 * If the slug already exists, appends a numeric suffix (-1, -2, …).
 */
async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title)
  let slug = base
  let suffix = 0

  while (await postRepository.findBySlug(slug)) {
    suffix++
    slug = `${base}-${suffix}`
  }

  return slug
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * True when HTML has no real text content. Tiptap serializes an empty
 * document as "<p></p>", which a naive `!value` check would miss.
 */
function isBlankHtml(value: string | null | undefined): boolean {
  if (!value) return true
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length === 0
}

function canPublish(titleEn: string | null | undefined, contentEn: string | null | undefined): boolean {
  return !isBlankHtml(titleEn) && !isBlankHtml(contentEn)
}

/**
 * Converts blank titleEn/excerptEn/contentEn to null before they reach the
 * repository, so a cleared EN tab actually clears the DB column instead of
 * persisting "<p></p>" — which would otherwise defeat both the publish gate
 * and the frontend's null-means-untranslated fallback.
 */
function normalizeLocaleFields<T extends { titleEn?: string; excerptEn?: string; contentEn?: string }>(
  body: T
): T {
  const result = { ...body }
  if (result.titleEn !== undefined && isBlankHtml(result.titleEn)) {
    result.titleEn = null as unknown as string
  }
  if (result.excerptEn !== undefined && isBlankHtml(result.excerptEn)) {
    result.excerptEn = null as unknown as string
  }
  if (result.contentEn !== undefined && isBlankHtml(result.contentEn)) {
    result.contentEn = null as unknown as string
  }
  return result
}

/**
 * Scan post HTML content (both languages) for media URLs and sync the
 * MediaOnPosts junction table. Automatically adds/removes relations based on
 * what images are actually in the content.
 */
async function syncMediaUsage(postId: string, content: string, contentEn?: string | null) {
  // Match media filenames (uuid.ext, as generated in media.routes.ts) anywhere in
  // the content, regardless of what URL they're embedded in — S3 URLs today,
  // but this stays robust if the storage backend or URL shape changes again.
  const filenameRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+/g
  const combined = content + '\n' + (contentEn ?? '')
  const filenames = combined.match(filenameRegex) || []

  if (filenames.length === 0) {
    // No media in post — clear all relations
    await prisma.mediaOnPosts.deleteMany({ where: { postId } })
    return
  }

  // Find media records by filename
  const mediaRecords = await prisma.media.findMany({
    where: { filename: { in: filenames } },
    select: { id: true },
  })

  const mediaIds = mediaRecords.map((m) => m.id)

  // Replace all relations for this post
  await prisma.$transaction([
    prisma.mediaOnPosts.deleteMany({ where: { postId } }),
    ...mediaIds.map((mediaId) =>
      prisma.mediaOnPosts.create({ data: { mediaId, postId } })
    ),
  ])
}
