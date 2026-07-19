import { z } from 'zod'

/** Reusable cursor + limit query schema, extend() with endpoint-specific filters. */
export function cursorQuerySchema(defaultLimit: number) {
  return z.object({
    cursor: z.string().min(1).optional(),
    limit:  z.coerce.number().int().min(1).max(100).default(defaultLimit),
  })
}
