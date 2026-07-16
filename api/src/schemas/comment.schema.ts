import { z } from 'zod'

// ─── Query schemas ─────────────────────────────────────────────────────────────

export const listCommentsQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
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
