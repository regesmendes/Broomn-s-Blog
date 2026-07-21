import { prisma } from '../lib/prisma'
import { paginateWithCursor } from '../lib/pagination'

// The persona substituted for isOwnerReply comments in any public response —
// the admin's real Google identity (name/avatar) must never reach a public
// API consumer for these rows. Reuses the site's square favicon rather than
// sourcing a separate asset — the wordmark logo isn't square and stretches
// when forced into a circular avatar frame.
export const BROOMN_PERSONA = {
  id:        null,
  name:      'Broomn',
  avatarUrl: '/favicon.png',
} as const

const commentSelect = {
  id:           true,
  content:      true,
  approved:     true,
  isOwnerReply: true,
  parentId:     true,
  createdAt:    true,
  user: {
    select: {
      id:        true,
      name:      true,
      avatarUrl: true,
    },
  },
} as const

// One level of nested replies under each top-level public comment — replies
// can't themselves be replied to, so no further recursion is needed.
const publicCommentSelect = {
  ...commentSelect,
  replies: {
    where:   { approved: true },
    orderBy: { createdAt: 'asc' as const },
    select:  commentSelect,
  },
} as const

// Admin view nests replies too (so the moderation UI can show them under
// their parent, like the public page does) but — unlike publicCommentSelect —
// doesn't filter by approved or mask identity: admins need the real state.
const adminCommentSelect = {
  ...commentSelect,
  replies: {
    orderBy: { createdAt: 'asc' as const },
    select:  commentSelect,
  },
  post: {
    select: {
      id:    true,
      title: true,
      slug:  true,
    },
  },
} as const

/** Substitutes the Broomn persona for the real user on owner-reply rows —
 * the only place identity masking happens, applied to every public response. */
function maskOwnerReply<T extends { isOwnerReply: boolean; user: unknown; replies?: unknown[] }>(
  comment: T
): T {
  const masked = comment.isOwnerReply ? { ...comment, user: BROOMN_PERSONA } : comment
  if (!masked.replies) return masked
  return { ...masked, replies: masked.replies.map((r) => maskOwnerReply(r as typeof comment)) }
}

export const commentRepository = {
  /** Get approved top-level comments for a post, with their approved replies
   * nested underneath — real identity masked wherever isOwnerReply is set. */
  async findApprovedByPost(postId: string, cursor: string | undefined, limit: number) {
    const where = { postId, approved: true, parentId: null }

    const page = await paginateWithCursor(
      (args) =>
        prisma.comment.findMany({
          where,
          select:  publicCommentSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      { cursor, limit }
    )

    return { ...page, data: page.data.map(maskOwnerReply) }
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

  /** Find a comment as a reply target — includes what's needed to validate
   * it's a top-level comment and to notify the original commenter. */
  async findByIdForReply(id: string) {
    return prisma.comment.findUnique({
      where: { id },
      select: {
        id:       true,
        postId:   true,
        parentId: true,
        user: {
          select: {
            email: true,
          },
        },
        post: {
          select: {
            title: true,
            slug:  true,
          },
        },
      },
    })
  },

  /** Create an owner (Broomn) reply — auto-approved, since it's the trusted
   * site owner replying, not a random visitor comment awaiting moderation. */
  async createReply(postId: string, adminUserId: string, parentId: string, content: string) {
    const comment = await prisma.comment.create({
      data: {
        postId,
        parentId,
        content,
        userId:       adminUserId,
        isOwnerReply: true,
        approved:     true,
      },
      select: commentSelect,
    })

    return maskOwnerReply(comment)
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
   * Get all top-level comments across all posts (admin), each with its
   * replies nested underneath. Filterable by approval status — a top-level
   * comment matches if it *or any of its replies* has that approval status,
   * not just itself. Without the "or a reply matches" half, an approved
   * Broomn reply would vanish from view the moment its parent's own status
   * didn't match the selected tab (e.g. parent still pending, or parent
   * approved but viewing the "Pending" tab) — the reply is real, approved
   * content and shouldn't disappear because of its parent's unrelated state.
   * Also returns a total count of top-level comments — a single indexed
   * COUNT() for a dashboard stat, not the per-page cost cursor pagination
   * replaces.
   */
  async findAll(cursor: string | undefined, limit: number, approved?: boolean) {
    const where = {
      parentId: null,
      ...(approved !== undefined
        ? { OR: [{ approved }, { replies: { some: { approved } } }] }
        : {}),
    }

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
