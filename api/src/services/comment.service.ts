import { commentRepository } from '../repositories/comment.repository'
import { ListCommentsQuery } from '../schemas/comment.schema'

export interface PaginationMeta {
  total:      number
  page:       number
  limit:      number
  totalPages: number
}

export const commentService = {
  /** List approved comments for a post (public). */
  async listApproved(postId: string, query: ListCommentsQuery) {
    const { page, limit } = query
    const { total, comments } = await commentRepository.findApprovedByPost(postId, page, limit)

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }

    return { data: comments, meta }
  },

  /** List ALL comments for a post — admin moderation. */
  async listAll(postId: string, query: ListCommentsQuery) {
    const { page, limit } = query
    const { total, comments } = await commentRepository.findAllByPost(postId, page, limit)

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }

    return { data: comments, meta }
  },

  /** Create a comment. */
  async create(postId: string, userId: string, content: string) {
    return commentRepository.create(postId, userId, content)
  },

  /** Approve or reject a comment (admin only). */
  async setApproval(id: string, approved: boolean) {
    const comment = await commentRepository.findById(id)
    if (!comment) return null
    return commentRepository.setApproval(id, approved)
  },

  /** Delete a comment (admin or comment owner). */
  async delete(id: string, userId: string, isAdmin: boolean) {
    const comment = await commentRepository.findById(id)
    if (!comment) return null

    // Only the comment owner or an admin can delete
    if (comment.user.id !== userId && !isAdmin) {
      return 'forbidden'
    }

    await commentRepository.delete(id)
    return 'deleted'
  },
}
