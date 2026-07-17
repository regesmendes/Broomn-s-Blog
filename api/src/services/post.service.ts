import { postRepository } from '../repositories/post.repository'
import {
  CreatePostBody,
  UpdatePostBody,
  PublishPostBody,
  ListPostsQuery,
} from '../schemas/post.schema'

// ─── Pagination meta ───────────────────────────────────────────────────────────

export interface PaginationMeta {
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

// ─── Service ───────────────────────────────────────────────────────────────────

export const postService = {
  async listPublished(query: ListPostsQuery) {
    const { page, limit, tag, search } = query
    const { total, posts } = await postRepository.findPublished({ page, limit, tag, search })

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }

    // Flatten tags from join table shape to a clean array
    return { data: posts.map(flattenTags), meta }
  },

  async getPublishedBySlug(slug: string) {
    const post = await postRepository.findPublishedBySlug(slug)
    if (!post) return null
    return flattenTags(post)
  },

  async getById(id: string) {
    const post = await postRepository.findById(id)
    if (!post) return null
    return flattenTags(post)
  },

  async create(body: CreatePostBody) {
    const slug = body.slug ?? (await generateUniqueSlug(body.title))

    return flattenTags(await postRepository.create({ ...body, slug }))
  },

  async update(id: string, body: UpdatePostBody) {
    const existing = await postRepository.findById(id)
    if (!existing) return null

    // If title changed and no explicit slug given, regenerate slug
    if (body.title && !body.slug && body.title !== existing.title) {
      body.slug = await generateUniqueSlug(body.title)
    }

    return flattenTags(await postRepository.update(id, body))
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
  const { tags, ...rest } = post as any
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
