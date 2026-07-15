import { prisma } from '../lib/prisma'

const userSelect = {
  id:        true,
  email:     true,
  name:      true,
  avatarUrl: true,
  role:      true,
  googleId:  true,
  cognitoId: true,
  createdAt: true,
} as const

export interface UpsertUserData {
  email:     string
  name:      string
  avatarUrl?: string
  googleId?: string
  cognitoId?: string
}

export const userRepository = {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: userSelect })
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, select: userSelect })
  },

  async findByCognitoId(cognitoId: string) {
    return prisma.user.findUnique({ where: { cognitoId }, select: userSelect })
  },

  /**
   * Find by cognitoId, create if not found.
   * On subsequent logins updates name and avatarUrl in case they changed on Google.
   */
  async upsertByCognitoId(cognitoId: string, data: UpsertUserData) {
    return prisma.user.upsert({
      where:  { cognitoId },
      update: {
        name:      data.name,
        avatarUrl: data.avatarUrl,
      },
      create: {
        ...data,
        cognitoId,
      },
      select: userSelect,
    })
  },
}
