import { z } from 'zod'
import { cursorQuerySchema } from './pagination.schema'

export const subscribeSchema = z.object({
  email: z.string().email(),
})

export const confirmSchema = z.object({
  token: z.string().min(1),
})

export const unsubscribeSchema = z.object({
  token: z.string().min(1),
})

export const sendNewsletterSchema = z.object({
  subject: z.string().min(1).max(200),
  content: z.string().min(1), // HTML body
})

export const listSubscribersQuerySchema = cursorQuerySchema(50).extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'UNSUBSCRIBED']).optional(),
  email:  z.string().optional(),
})

export const subscriberIdParamSchema = z.object({
  id: z.string().min(1),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

export type SubscribeBody        = z.infer<typeof subscribeSchema>
export type ConfirmParams        = z.infer<typeof confirmSchema>
export type UnsubscribeParams    = z.infer<typeof unsubscribeSchema>
export type SendNewsletterBody   = z.infer<typeof sendNewsletterSchema>
export type ListSubscribersQuery = z.infer<typeof listSubscribersQuerySchema>
export type SubscriberIdParam    = z.infer<typeof subscriberIdParamSchema>
