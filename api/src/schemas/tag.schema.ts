import { z } from 'zod'
import { cursorQuerySchema } from './pagination.schema'

// ─── Query schemas ─────────────────────────────────────────────────────────────

export const listAdminTagsQuerySchema = cursorQuerySchema(10).extend({
  search: z.string().optional(),
})

// ─── Param schemas ─────────────────────────────────────────────────────────────

export const tagIdParamSchema = z.object({
  id: z.string().min(1),
})

// ─── Body schemas ──────────────────────────────────────────────────────────────

export const renameTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

export type ListAdminTagsQuery = z.infer<typeof listAdminTagsQuerySchema>
export type TagIdParam         = z.infer<typeof tagIdParamSchema>
export type RenameTagBody      = z.infer<typeof renameTagSchema>
