import { prisma } from '../lib/prisma'

export interface CreateRequestLogData {
  userId:     string
  sessionId?: string
  method:     string
  path:       string
  statusCode: number
  durationMs: number
}

export interface CreatePageViewData {
  userId:     string
  sessionId:  string
  path:       string
  durationMs: number
}

export const analyticsRepository = {
  async createRequestLog(data: CreateRequestLogData) {
    return prisma.requestLog.create({ data })
  },

  async createPageView(data: CreatePageViewData) {
    return prisma.pageView.create({ data })
  },

  async countRequestsBetween(from: Date, to: Date) {
    return prisma.requestLog.count({
      where: { createdAt: { gte: from, lte: to } },
    })
  },

  /**
   * Requests grouped per user in a period, busiest first. A capped list, not
   * cursor-paginated — the result set is bounded by registered-user count,
   * not an ever-growing content list (see docs/architecture.md).
   */
  async countRequestsByUser(from: Date, to: Date, limit: number) {
    return prisma.requestLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    })
  },

  /**
   * One user's browsing sessions in a period, most recent first. Each row is
   * one sessionId with its page count and first/last activity timestamps.
   */
  async listSessionsForUser(userId: string, from: Date, to: Date, limit: number) {
    return prisma.pageView.groupBy({
      by: ['sessionId'],
      where: { userId, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: limit,
    })
  },

  /** Full page-view journey of one session, in visit order. */
  async listPageViewsForSession(userId: string, sessionId: string) {
    return prisma.pageView.findMany({
      where:   { userId, sessionId },
      orderBy: { createdAt: 'asc' },
    })
  },

  /**
   * Every logged API action in one session, in call order — merged with
   * listPageViewsForSession's rows to reconstruct the full journey. Includes
   * GETs as well as mutations: any request the user's own browsing generated
   * is a real step in their journey, not just mutations. Hidden background
   * mechanics (auth token refresh) and analytics's own traffic are excluded
   * at write time (see the onSend hook in app.ts), so nothing needs
   * filtering back out here.
   */
  async listRequestLogsForSession(userId: string, sessionId: string) {
    return prisma.requestLog.findMany({
      where:   { userId, sessionId },
      orderBy: { createdAt: 'asc' },
    })
  },

  async pruneOlderThan(cutoff: Date) {
    const [requestLogs, pageViews] = await Promise.all([
      prisma.requestLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      prisma.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    ])
    return { requestLogs: requestLogs.count, pageViews: pageViews.count }
  },
}
