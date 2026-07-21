import { prisma } from '../lib/prisma'
import { SubscriptionStatus } from '@prisma/client'
import { paginateWithCursor } from '../lib/pagination'

const subscriberSelect = {
  id:          true,
  email:       true,
  status:      true,
  confirmedAt: true,
  createdAt:   true,
  blockedAt:   true,
} as const

export const newsletterRepository = {
  async findByEmail(email: string) {
    return prisma.newsletter.findUnique({ where: { email }, select: subscriberSelect })
  },

  async findById(id: string) {
    return prisma.newsletter.findUnique({ where: { id }, select: subscriberSelect })
  },

  /**
   * Upsert-subscribe by email, except a blocked address stays blocked — the
   * previous unconditional upsert would silently reset a blocked row back
   * to PENDING, undoing the block the moment someone resubmitted the form.
   */
  async subscribe(email: string, userId?: string) {
    const existing = await prisma.newsletter.findUnique({ where: { email } })
    if (existing?.blockedAt) return 'blocked' as const

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

  /** Self-service or admin-triggered unsubscribe — only ever touches
   * `status`, never `blockedAt`. This is what makes "unsubscribe but stay
   * blocked" work for free: a self-unsubscribe on an already-blocked row
   * leaves blockedAt untouched, with no special-casing needed. */
  async unsubscribe(id: string) {
    return prisma.newsletter.update({
      where: { id },
      data:  { status: 'UNSUBSCRIBED' },
      select: subscriberSelect,
    })
  },

  /** Block a subscriber — stops delivery immediately and prevents
   * re-subscribing (see `subscribe` above). Admin only. */
  async block(id: string) {
    return prisma.newsletter.update({
      where: { id },
      data:  { blockedAt: new Date(), status: 'UNSUBSCRIBED' },
      select: subscriberSelect,
    })
  },

  /** Unblock — falls out of the same single field, no extra state to
   * reconcile (status is left as UNSUBSCRIBED; re-subscribing is a
   * separate, explicit action). */
  async unblock(id: string) {
    return prisma.newsletter.update({
      where: { id },
      data:  { blockedAt: null },
      select: subscriberSelect,
    })
  },

  async listSubscribers(cursor: string | undefined, limit: number, status?: SubscriptionStatus, email?: string) {
    const where = {
      ...(status ? { status } : {}),
      ...(email ? { email: { contains: email, mode: 'insensitive' as const } } : {}),
    }

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
    // blockedAt: null is defense-in-depth alongside the status filter — a
    // blocked address is always also set to UNSUBSCRIBED (see `block`
    // above), so this shouldn't ever bite in practice, but a send should
    // never depend on that invariant holding elsewhere going forward.
    return prisma.newsletter.findMany({
      where:  { status: 'CONFIRMED', blockedAt: null },
      select: { id: true, email: true },
    })
  },
}
