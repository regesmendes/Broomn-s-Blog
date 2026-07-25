import { prisma } from '../lib/prisma'
import { SubscriptionStatus } from '@prisma/client'
import { paginateWithCursor } from '../lib/pagination'

const subscriberSelect = {
  id:             true,
  email:          true,
  status:         true,
  confirmedAt:    true,
  createdAt:      true,
  blockedAt:      true,
  unsubscribedAt: true,
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
   * `status`/`unsubscribedAt`, never `blockedAt`. This is what makes
   * "unsubscribe but stay blocked" work for free: a self-unsubscribe on an
   * already-blocked row leaves blockedAt untouched, with no special-casing
   * needed. `unsubscribedAt` is a dedicated per-transition timestamp (like
   * `confirmedAt`), not a generic updatedAt — see the schema comment. */
  async unsubscribe(id: string) {
    return prisma.newsletter.update({
      where: { id },
      data:  { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
      select: subscriberSelect,
    })
  },

  /** Block a subscriber — stops delivery immediately and prevents
   * re-subscribing (see `subscribe` above). Admin only. Also sets
   * `unsubscribedAt`, since this transitions status to UNSUBSCRIBED too. */
  async block(id: string) {
    const now = new Date()
    return prisma.newsletter.update({
      where: { id },
      data:  { blockedAt: now, status: 'UNSUBSCRIBED', unsubscribedAt: now },
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

  /**
   * Subscriber split for the analytics dashboard. `blocked` cuts across the
   * UNSUBSCRIBED status (block() sets both), so it needs its own bucket with
   * the other three excluding blocked rows. Together, all four buckets
   * partition every subscriber row exactly once — they sum to the total.
   */
  async countForAnalytics(): Promise<{
    subscribed: number
    unsubscribed: number
    blocked: number
    pending: number
  }> {
    const [subscribed, unsubscribed, blocked, pending] = await Promise.all([
      prisma.newsletter.count({ where: { status: 'CONFIRMED', blockedAt: null } }),
      prisma.newsletter.count({ where: { status: 'UNSUBSCRIBED', blockedAt: null } }),
      prisma.newsletter.count({ where: { blockedAt: { not: null } } }),
      // blockedAt: null is defense-in-depth, same as the other three buckets
      // — block() always forces status to UNSUBSCRIBED, so a PENDING+blocked
      // row shouldn't occur, but a dashboard count shouldn't depend on that
      // holding elsewhere. With this bucket added, all four now partition
      // every row exactly once — they sum to the total subscriber count.
      prisma.newsletter.count({ where: { status: 'PENDING', blockedAt: null } }),
    ])
    return { subscribed, unsubscribed, blocked, pending }
  },

  /** New confirmations in a period — by confirmedAt, not createdAt, so this
   * reflects when someone actually became a subscriber, not when they first
   * submitted the form (which may have been confirmed much later, or never). */
  async countSubscribedBetween(from: Date, to: Date) {
    return prisma.newsletter.count({ where: { confirmedAt: { gte: from, lte: to } } })
  },

  /** Unsubscribe events in a period — excludes blocked rows, mirroring
   * countForAnalytics()'s distinction between organic unsubscribes and
   * admin blocks (block() also sets unsubscribedAt, but that's a separate,
   * admin-initiated event, not churn). */
  async countUnsubscribedBetween(from: Date, to: Date) {
    return prisma.newsletter.count({
      where: { unsubscribedAt: { gte: from, lte: to }, blockedAt: null },
    })
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
