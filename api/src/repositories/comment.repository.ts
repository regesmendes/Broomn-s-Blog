import { prisma } from '../lib/prisma'
import { paginateWithCursor } from '../lib/pagination'

const commentSelect = {
  id:        true,
  content:   true,
  approved:  true,
  createdAt: true,
  user: {
    select: {
      id:        true,
      name:      true,
      avatarUrl: true,
    },
  },
} as const

const adminCommentSelect = {
  id:        true,
  content:   true,
  approved:  true,
  createdAt: true,
  user: {
    select: {
      id:        true,
      name:      true,
      avatarUrl: true,
    },
  },
  post: {
    select: {
      id:    true,
      title: true,
      slug:  true,
    },
  },
} as const

export const commentRepository = {
  /** Get approved comments for a post (public). */
  async findApprovedByPost(postId: string, cursor: string | undefined, limit: number) {
    const where = { postId, approved: true }

    return paginateWithCursor(
      (args) =>
        prisma.comment.findMany({
          where,
          select:  commentSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      { cursor, limit }
    )
  },

  /** Get ALL comments for a post — admin moderation view. */
  async findAllByPost(postId: string, cursor: string | undefined, limit: number) {
    const where = { postId }

    return paginateWithCursor(
      (args) =>
        prisma.comment.findMany({
          where,
          select:  commentSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      { cursor, limit }
    )
  },

  /** Create a comment (not approved by default). */
  async create(postId: string, userId: string, content: string) {
    return prisma.comment.create({
      data: { postId, userId, content },
      select: commentSelect,
    })
  },

  /** Find by id. */
  async findById(id: string) {
    return prisma.comment.findUnique({
      where: { id },
      select: commentSelect,
    })
  },

  /** Count a user's comments still awaiting moderation. */
  async countPendingByUser(userId: string) {
    return prisma.comment.count({ where: { userId, approved: false } })
  },

  /** Approve or reject a comment. */
  async setApproval(id: string, approved: boolean) {
    return prisma.comment.update({
      where: { id },
      data:  { approved },
      select: commentSelect,
    })
  },

  /** Delete a comment. */
  async delete(id: string) {
    return prisma.comment.delete({ where: { id } })
  },

  /**
   * Get all comments across all posts (admin). Filterable by approval status.
   * Also returns a total count — a single indexed COUNT() for a dashboard
   * stat, not the per-page cost cursor pagination replaces.
   */
  async findAll(cursor: string | undefined, limit: number, approved?: boolean) {
    const where = approved !== undefined ? { approved } : {}

    const [total, page] = await Promise.all([
      prisma.comment.count({ where }),
      paginateWithCursor(
        (args) =>
          prisma.comment.findMany({
            where,
            select:  adminCommentSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
          }),
        { cursor, limit }
      ),
    ])

    return { ...page, total }
  },
}
