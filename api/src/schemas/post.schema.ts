import { z } from 'zod'
import { cursorQuerySchema } from './pagination.schema'

// ─── Query schemas ─────────────────────────────────────────────────────────────

export const listPostsQuerySchema = cursorQuerySchema(10).extend({
  tag:    z.string().optional(),
  search: z.string().optional(),
})

export const postSlugParamSchema = z.object({
  slug: z.string().min(1),
})

export const postIdParamSchema = z.object({
  id: z.string().min(1),
})

// ─── Body schemas ──────────────────────────────────────────────────────────────

export const createPostSchema = z.object({
  title:       z.string().min(1).max(255),
  slug:        z.string().min(1).max(255).optional(), // auto-generated if omitted
  excerpt:     z.string().max(500).optional(),
  content:     z.string().min(1),
  coverImage:  z.string().url().optional(),
  status:      z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  publishedAt: z.string().datetime().optional(),
  tags:        z.array(z.string()).optional(), // array of tag names
})

export const updatePostSchema = createPostSchema.partial()

export const publishPostSchema = z.object({
  status:      z.enum(['DRAFT', 'PUBLISHED']),
  publishedAt: z.string().datetime().optional(),
})

// ─── Inferred types ────────────────────────────────────────────────────────────

export type ListPostsQuery  = z.infer<typeof listPostsQuerySchema>
export type PostSlugParam   = z.infer<typeof postSlugParamSchema>
export type PostIdParam     = z.infer<typeof postIdParamSchema>
export type CreatePostBody  = z.infer<typeof createPostSchema>
export type UpdatePostBody  = z.infer<typeof updatePostSchema>
export type PublishPostBody = z.infer<typeof publishPostSchema>
