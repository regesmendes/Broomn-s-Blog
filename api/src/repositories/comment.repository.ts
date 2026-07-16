import { prisma } from '../lib/prisma'

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
  async findApprovedByPost(postId: string, page: number, limit: number) {
    const where = { postId, approved: true }

    const [total, comments] = await prisma.$transaction([
      prisma.comment.count({ where }),
      prisma.comment.findMany({
        where,
        select:  commentSelect,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
    ])

    return { total, comments }
  },

  /** Get ALL comments for a post — admin moderation view. */
  async findAllByPost(postId: string, page: number, limit: number) {
    const where = { postId }

    const [total, comments] = await prisma.$transaction([
      prisma.comment.count({ where }),
      prisma.comment.findMany({
        where,
        select:  commentSelect,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
    ])

    return { total, comments }
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

  /** Get all comments across all posts (admin). Filterable by approval status. */
  async findAll(page: number, limit: number, approved?: boolean) {
    const where = approved !== undefined ? { approved } : {}

    const [total, comments] = await prisma.$transaction([
      prisma.comment.count({ where }),
      prisma.comment.findMany({
        where,
        select:  adminCommentSelect,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
    ])

    return { total, comments }
  },
}
