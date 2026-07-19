import { prisma } from '../lib/prisma'
import { SubscriptionStatus } from '@prisma/client'
import { paginateWithCursor } from '../lib/pagination'

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

  async listSubscribers(cursor: string | undefined, limit: number, status?: SubscriptionStatus) {
    const where = status ? { status } : {}

    return paginateWithCursor(
      (args) =>
        prisma.newsletter.findMany({
          where,
          select:  subscriberSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      { cursor, limit }
    )
  },

  /**
   * Aggregate subscriber counts by status, for the admin dashboard stat cards.
   * A groupBy/count is a single indexed aggregate scan — independent of how
   * deep the paginated list above is, unlike an OFFSET-based total.
   */
  async countByStatus(): Promise<{
    total: number
    confirmed: number
    pending: number
    unsubscribed: number
  }> {
    const counts = await prisma.newsletter.groupBy({
      by: ['status'],
      _count: true,
    })

    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<
      SubscriptionStatus,
      number
    >

    return {
      total:        counts.reduce((sum, c) => sum + c._count, 0),
      confirmed:    byStatus.CONFIRMED ?? 0,
      pending:      byStatus.PENDING ?? 0,
      unsubscribed: byStatus.UNSUBSCRIBED ?? 0,
    }
  },

  /** Get all confirmed subscribers (id + email, for sending with per-recipient unsubscribe links). */
  async getConfirmedSubscribers(): Promise<{ id: string; email: string }[]> {
    return prisma.newsletter.findMany({
      where:  { status: 'CONFIRMED' },
      select: { id: true, email: true },
    })
  },
}
