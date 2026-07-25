import { z } from 'zod'

export const trackPageViewSchema = z.object({
  path:       z.string().min(1).max(300),
  sessionId:  z.string().uuid(),
  // 6h cap — defense-in-depth against a stuck client clock inflating stats
  durationMs: z.number().int().min(0).max(6 * 60 * 60 * 1000),
})

const dateRangeFields = {
  from: z.coerce.date().optional(),
  to:   z.coerce.date().optional(),
}

export const summaryQuerySchema = z.object(dateRangeFields)

export const requestsByUserQuerySchema = z.object({
  ...dateRangeFields,
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const userSessionsQuerySchema = z.object({
  ...dateRangeFields,
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
