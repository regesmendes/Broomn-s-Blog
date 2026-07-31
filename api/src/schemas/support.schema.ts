import { z } from 'zod'

// ─── Body schemas ──────────────────────────────────────────────────────────────

export const updateSupportSchema = z.object({
  content:   z.string().min(1),
  contentEn: z.string().optional(),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

export type UpdateSupportBody = z.infer<typeof updateSupportSchema>
