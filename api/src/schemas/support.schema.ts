import { z } from 'zod'

// ─── Body schemas ──────────────────────────────────────────────────────────────

export const updateSupportSchema = z.object({
  content: z.string().min(1),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

export type UpdateSupportBody = z.infer<typeof updateSupportSchema>
