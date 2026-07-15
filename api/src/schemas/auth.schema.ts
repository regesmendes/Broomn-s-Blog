import { z } from 'zod'

export const googleAuthSchema = z.object({
  // The Cognito ID token returned after Google login
  idToken: z.string().min(1),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

export type GoogleAuthBody  = z.infer<typeof googleAuthSchema>
export type RefreshTokenBody = z.infer<typeof refreshTokenSchema>
