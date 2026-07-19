import { prisma } from '../lib/prisma'
import { CreatePostBody, UpdatePostBody } from '../schemas/post.schema'
import { paginateWithCursor } from '../lib/pagination'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface FindPublishedPostsOptions {
  cursor?: string
  limit:   number
  tag?:    string
  search?: string
}

export interface UpsertTagsResult {
  tagId: string
}

// ─── Selects ───────────────────────────────────────────────────────────────────

// Reusable shape returned for post list items
const postSummarySelect = {
  id:          true,
  title:       true,
  slug:        true,
  excerpt:     true,
  coverImage:  true,
  status:      true,
  publishedAt: true,
  createdAt:   true,
  tags: {
    select: {
      tag: { select: { id: true, name: true, slug: true } },
    },
  },
} as const

// Full post (includes content)
const postFullSelect = {
  ...postSummarySelect,
  content:   true,
  updatedAt: true,
} as const

// ─── Repository ────────────────────────────────────────────────────────────────

export const postRepository = {
  /**
   * Count and fetch published posts visible to the public.
   * A post is visible when status = PUBLISHED and publishedAt <= now.
   */
  async findPublished({ cursor, limit, tag, search }: FindPublishedPostsOptions) {
    const now = new Date()

    const where = {
      status:      'PUBLISHED' as const,
      publishedAt: { lte: now },
      ...(tag && {
        tags: {
          some: { tag: { slug: tag } },
        },
      }),
      ...(search && {
        OR: [
          { title:   { contains: search, mode: 'insensitive' as const } },
          { excerpt: { contains: search, mode: 'insensitive' as const } },
          { content: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    return paginateWithCursor(
      (args) =>
        prisma.post.findMany({
          where,
          select:  postSummarySelect,
          // publishedAt alone isn't unique — id breaks ties so cursor
          // pagination never skips or repeats a row across pages.
          orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      { cursor, limit }
    )
  },

  /** Find a single published post by slug. */
  async findPublishedBySlug(slug: string) {
    return prisma.post.findFirst({
      where: {
        slug,
        status:      'PUBLISHED',
        publishedAt: { lte: new Date() },
      },
      select: postFullSelect,
    })
  },

  /** Find any post by id, regardless of status (admin use). */
  async findById(id: string) {
    return prisma.post.findUnique({
      where:  { id },
      select: postFullSelect,
    })
  },

  /** Find any post by slug (admin use — includes drafts). */
  async findBySlug(slug: string) {
    return prisma.post.findUnique({
      where: { slug },
    })
  },

  /** Create a post and connect tags. */
  async create(data: CreatePostBody & { slug: string }) {
    const { tags, publishedAt, ...rest } = data

    return prisma.post.create({
      data: {
        ...rest,
        publishedAt: publishedAt ? new Date(publishedAt) : null,
        ...(tags?.length && {
          tags: {
            create: await buildTagConnections(tags),
          },
        }),
      },
      select: postFullSelect,
    })
  },

  /** Update a post and replace its tags if provided. */
  async update(id: string, data: UpdatePostBody) {
    const { tags, publishedAt, ...rest } = data

    return prisma.post.update({
      where: { id },
      data: {
        ...rest,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
        ...(tags !== undefined && {
          tags: {
            deleteMany: {},
            create: await buildTagConnections(tags),
          },
        }),
      },
      select: postFullSelect,
    })
  },

  /** Delete a post by id. */
  async delete(id: string) {
    return prisma.post.delete({ where: { id } })
  },

  /** Update only status and publishedAt. */
  async updatePublishState(
    id: string,
    status: 'DRAFT' | 'PUBLISHED',
    publishedAt?: string
  ) {
    return prisma.post.update({
      where: { id },
      data: {
        status,
        publishedAt: publishedAt
          ? new Date(publishedAt)
          : status === 'DRAFT'
            ? null        // revert to draft clears the date
            : undefined,
      },
      select: postFullSelect,
    })
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Upsert tags by name and return the format Prisma expects for
 * nested tag creation on a post.
 */
async function buildTagConnections(tagNames: string[]) {
  const tags = await Promise.all(
    tagNames.map((name) => {
      const slug = slugify(name)
      return prisma.tag.upsert({
        where:  { slug },
        update: {},
        create: { name, slug },
      })
    })
  )

  return tags.map((tag) => ({ tagId: tag.id }))
}

/** Simple slug generator (used only for tags here; posts use the service). */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
