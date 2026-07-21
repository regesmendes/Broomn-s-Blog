import { commentRepository } from '../repositories/comment.repository'
import { ListCommentsQuery } from '../schemas/comment.schema'
import { sendEmail } from '../lib/ses'

// Caps how many comments a single user can have awaiting moderation at once —
// both a flood-protection measure and a bound on the admin moderation queue.
// Read at call time (not module load) so tests can override it per-case.
const MAX_PENDING_COMMENTS_PER_USER = () => Number(process.env.MAX_PENDING_COMMENTS_PER_USER ?? 15)

function getFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:3000'
}

function replyNotificationEmail(postTitle: string, postUrl: string) {
  return {
    subject: 'Broomn respondeu ao seu comentário — Blog do Broomn',
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
        <h1 style="font-size: 22px;">Blog do Broomn</h1>
        <p>Broomn respondeu ao seu comentário em <strong>${postTitle}</strong>.</p>
        <p><a href="${postUrl}" style="color: #1d4ed8;">Ver a resposta</a></p>
      </div>
    `,
    text: `Blog do Broomn\n\nBroomn respondeu ao seu comentário em "${postTitle}".\n\nVer a resposta: ${postUrl}`,
  }
}

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

  /**
   * Reply to a comment as Broomn (admin only). Only top-level comments can be
   * replied to — a reply itself can't get a further nested reply. Notifies
   * the original commenter by email, best-effort (a delivery failure doesn't
   * undo the reply, which is already saved).
   */
  async replyAsBroomn(parentId: string, adminUserId: string, content: string) {
    const parent = await commentRepository.findByIdForReply(parentId)
    if (!parent) return null
    if (parent.parentId !== null) return 'invalid_parent'

    const reply = await commentRepository.createReply(parent.postId, adminUserId, parentId, content)

    if (parent.user.email) {
      const postUrl = `${getFrontendUrl()}/pt/posts/${parent.post.slug}`
      try {
        await sendEmail({ to: parent.user.email, ...replyNotificationEmail(parent.post.title, postUrl) })
      } catch (err) {
        console.error(`Failed to send reply notification to ${parent.user.email}:`, err)
      }
    }

    return reply
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
