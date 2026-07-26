import { z } from 'zod'

// ─── Param schemas ─────────────────────────────────────────────────────────────

export const tagIdParamSchema = z.object({
  id: z.string().min(1),
})

// ─── Body schemas ──────────────────────────────────────────────────────────────

export const renameTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

export type TagIdParam    = z.infer<typeof tagIdParamSchema>
export type RenameTagBody = z.infer<typeof renameTagSchema>
