import { z } from 'zod'
import { cursorQuerySchema } from './pagination.schema'

// ─── Query schemas ─────────────────────────────────────────────────────────────

export const listCommentsQuerySchema = cursorQuerySchema(20).extend({
  approved: z.enum(['true', 'false']).optional(),
})

export const commentPostParamSchema = z.object({
  postId: z.string().min(1),
})

export const commentIdParamSchema = z.object({
  id: z.string().min(1),
})

// ─── Body schemas ──────────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
})

export const approveCommentSchema = z.object({
  approved: z.boolean(),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

export type ListCommentsQuery   = z.infer<typeof listCommentsQuerySchema>
export type CommentPostParam    = z.infer<typeof commentPostParamSchema>
export type CommentIdParam      = z.infer<typeof commentIdParamSchema>
export type CreateCommentBody   = z.infer<typeof createCommentSchema>
export type ApproveCommentBody  = z.infer<typeof approveCommentSchema>
