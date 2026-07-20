import { commentRepository } from '../repositories/comment.repository'
import { ListCommentsQuery } from '../schemas/comment.schema'

// Caps how many comments a single user can have awaiting moderation at once —
// both a flood-protection measure and a bound on the admin moderation queue.
// Read at call time (not module load) so tests can override it per-case.
const MAX_PENDING_COMMENTS_PER_USER = () => Number(process.env.MAX_PENDING_COMMENTS_PER_USER ?? 15)

export const commentService = {
  /** List approved comments for a post (public). */
  async listApproved(postId: string, query: ListCommentsQuery) {
    const { cursor, limit } = query
    return commentRepository.findApprovedByPost(postId, cursor, limit)
  },

  /** List ALL comments for a post — admin moderation. */
  async listAll(postId: string, query: ListCommentsQuery) {
    const { cursor, limit } = query
    return commentRepository.findAllByPost(postId, cursor, limit)
  },

  /** List all comments across all posts — admin global view. */
  async listAllGlobal(query: ListCommentsQuery) {
    const { cursor, limit, approved } = query
    const approvedFilter = approved === 'true' ? true : approved === 'false' ? false : undefined
    const { data, meta, total } = await commentRepository.findAll(cursor, limit, approvedFilter)

    return { data, meta: { ...meta, total } }
  },

  /** Create a comment. Blocked once the user has too many comments pending moderation. */
  async create(postId: string, userId: string, content: string) {
    const pendingCount = await commentRepository.countPendingByUser(userId)
    if (pendingCount >= MAX_PENDING_COMMENTS_PER_USER()) {
      return 'limit_reached'
    }
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
