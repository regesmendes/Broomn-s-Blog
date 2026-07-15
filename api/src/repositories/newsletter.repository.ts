import { prisma } from '../lib/prisma'
import { SubscriptionStatus } from '@prisma/client'

const subscriberSelect = {
  id:          true,
  email:       true,
  status:      true,
  confirmedAt: true,
  createdAt:   true,
} as const

export const newsletterRepository = {
  async findByEmail(email: string) {
    return prisma.newsletter.findUnique({ where: { email }, select: subscriberSelect })
  },

  async findById(id: string) {
    return prisma.newsletter.findUnique({ where: { id }, select: subscriberSelect })
  },

  async subscribe(email: string, userId?: string) {
    return prisma.newsletter.upsert({
      where:  { email },
      update: { status: 'PENDING', userId },
      create: { email, status: 'PENDING', userId },
      select: subscriberSelect,
    })
  },

  async confirm(id: string) {
    return prisma.newsletter.update({
      where: { id },
      data:  { status: 'CONFIRMED', confirmedAt: new Date() },
      select: subscriberSelect,
    })
  },

  async unsubscribe(id: string) {
    return prisma.newsletter.update({
      where: { id },
      data:  { status: 'UNSUBSCRIBED' },
      select: subscriberSelect,
    })
  },

  async listSubscribers(page: number, limit: number, status?: SubscriptionStatus) {
    const where = status ? { status } : {}

    const [total, subscribers] = await prisma.$transaction([
      prisma.newsletter.count({ where }),
      prisma.newsletter.findMany({
        where,
        select:  subscriberSelect,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
    ])

    return { total, subscribers }
  },

  /** Get all confirmed subscriber emails (for sending). */
  async getConfirmedEmails(): Promise<string[]> {
    const subs = await prisma.newsletter.findMany({
      where:  { status: 'CONFIRMED' },
      select: { email: true },
    })
    return subs.map((s) => s.email)
  },
}
