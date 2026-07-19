import { z } from 'zod'

// ─── Body schemas ──────────────────────────────────────────────────────────────

export const updateAboutSchema = z.object({
  content: z.string().min(1),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

export type UpdateAboutBody = z.infer<typeof updateAboutSchema>
