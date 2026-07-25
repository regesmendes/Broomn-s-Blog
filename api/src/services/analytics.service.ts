import { analyticsRepository, CreatePageViewData } from '../repositories/analytics.repository'
import { userRepository } from '../repositories/user.repository'
import { newsletterRepository } from '../repositories/newsletter.repository'
import { postRepository } from '../repositories/post.repository'
import { commentRepository } from '../repositories/comment.repository'

const DEFAULT_PERIOD_DAYS = 30

/** Missing bounds default to the last 30 days ending now. */
function resolvePeriod(from?: Date, to?: Date) {
  const resolvedTo = to ?? new Date()
  const resolvedFrom =
    from ?? new Date(resolvedTo.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000)
  return { from: resolvedFrom, to: resolvedTo }
}

export const analyticsService = {
  async trackPageView(data: CreatePageViewData) {
    // The frontend tracker already skips the analytics dashboard's own pages,
    // but don't trust that — a stale client must not pollute journeys either
    if (data.path.startsWith('/admin/analytics')) return

    await analyticsRepository.createPageView(data)
  },

  async getSummary(fromQuery?: Date, toQuery?: Date) {
    const { from, to } = resolvePeriod(fromQuery, toQuery)

    const [
      totalUsers,
      newUsers,
      newPosts,
      postReads,
      commentsSubmitted,
      newsletter,
      requestsInPeriod,
    ] = await Promise.all([
      userRepository.countAll(),
      userRepository.countCreatedBetween(from, to),
      postRepository.countCreatedBetween(from, to),
      // Registered users only — same known limitation as the rest of this
      // dashboard, see docs/architecture.md
      analyticsRepository.countPageViewsByPathPrefix('/posts/', from, to),
      commentRepository.countCreatedBetween(from, to),
      newsletterRepository.countForAnalytics(),
      analyticsRepository.countRequestsBetween(from, to),
    ])

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      users: { totalAllTime: totalUsers, newInPeriod: newUsers },
      posts: {
        newInPeriod:      newPosts,
        readsInPeriod:    postReads,
        commentsInPeriod: commentsSubmitted,
      },
      newsletter,
      backend: { requestsInPeriod },
    }
  },

  async getRequestsByUser(
    fromQuery: Date | undefined,
    toQuery: Date | undefined,
    limit: number,
    offset: number,
    search?: string
  ) {
    const { from, to } = resolvePeriod(fromQuery, toQuery)

    let userIdFilter: string[] | undefined
    if (search) {
      userIdFilter = await userRepository.searchIds(search)
      // No matching user at all — skip the groupBy entirely rather than
      // asking Prisma to filter by an empty `in: []` list
      if (userIdFilter.length === 0) {
        return {
          period: { from: from.toISOString(), to: to.toISOString() },
          data:   [],
          meta:   { offset, limit, total: 0, hasMore: false },
        }
      }
    }

    // Full matching list, sliced in memory for offset pagination — see the
    // doc comment on analyticsRepository.countRequestsByUser for why
    const all = await analyticsRepository.countRequestsByUser(from, to, userIdFilter)
    const total = all.length
    const page = all.slice(offset, offset + limit)

    const users = await userRepository.findManyByIds(page.map((g) => g.userId))
    const byId = new Map(users.map((u) => [u.id, u]))

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      data: page.map((g) => ({
        userId:   g.userId,
        // Cascade-deleted users can't appear here (their logs go with them),
        // but don't crash the dashboard if a row races a deletion
        email:    byId.get(g.userId)?.email ?? '(deleted user)',
        name:     byId.get(g.userId)?.name ?? '(deleted user)',
        requests: g._count._all,
      })),
      meta: { offset, limit, total, hasMore: offset + limit < total },
    }
  },

  /** Returns null when the user doesn't exist (controller maps to 404). */
  async getSessionsForUser(
    userId: string,
    fromQuery: Date | undefined,
    toQuery: Date | undefined,
    limit: number
  ) {
    const user = await userRepository.findById(userId)
    if (!user) return null

    const { from, to } = resolvePeriod(fromQuery, toQuery)
    const grouped = await analyticsRepository.listSessionsForUser(userId, from, to, limit)

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      user:   { id: user.id, email: user.email, name: user.name },
      data: grouped.map((g) => ({
        sessionId: g.sessionId,
        pages:     g._count._all,
        firstSeen: g._min.createdAt,
        lastSeen:  g._max.createdAt,
      })),
    }
  },

  /**
   * Returns null when the session has no rows for that user (controller maps
   * to 404). Interleaves page views and logged API actions (comments, etc)
   * into one chronological list — the user's actual navigation, not just
   * which pages they loaded. Page views sort by *entry* time (when the user
   * arrived), not the write-time leftAt, so an action taken mid-visit (e.g.
   * a comment posted while reading a post) lands after that page's step and
   * before the next one, matching what really happened.
   */
  async getSessionJourney(userId: string, sessionId: string) {
    const [pageViews, requests] = await Promise.all([
      analyticsRepository.listPageViewsForSession(userId, sessionId),
      analyticsRepository.listRequestLogsForSession(userId, sessionId),
    ])
    if (pageViews.length === 0 && requests.length === 0) return null

    const pageViewSteps = pageViews.map((row) => {
      // createdAt is written at page-LEAVE; enteredAt is display-only, and
      // also this step's sort key (see the doc comment above)
      const enteredAt = new Date(row.createdAt.getTime() - row.durationMs)
      return {
        type:       'pageview' as const,
        id:         row.id,
        path:       row.path,
        durationMs: row.durationMs,
        enteredAt,
        leftAt:     row.createdAt,
        sortAt:     enteredAt,
      }
    })

    const actionSteps = requests.map((row) => ({
      type:       'action' as const,
      id:         row.id,
      method:     row.method,
      path:       row.path,
      statusCode: row.statusCode,
      durationMs: row.durationMs,
      createdAt:  row.createdAt,
      sortAt:     row.createdAt,
    }))

    const sorted = [...pageViewSteps, ...actionSteps].sort(
      (a, b) => a.sortAt.getTime() - b.sortAt.getTime()
    )

    // Collapse consecutive pageview steps for the same path into one. The
    // tracking hook's 'hidden' trigger (usePageViewTracking.ts) flushes and
    // resets its clock whenever the tab is backgrounded, as a safety net so
    // progress isn't lost if the tab gets killed while hidden — but if the
    // user simply alt-tabs away and back to the *same* page before actually
    // navigating, that produces two PageView rows for one continuous visit.
    // That's a write-time safety concern, not a real second visit, so the
    // journey presents it as a single step with the durations summed.
    const merged: typeof sorted = []
    for (const step of sorted) {
      const prev = merged[merged.length - 1]
      if (step.type === 'pageview' && prev?.type === 'pageview' && prev.path === step.path) {
        prev.durationMs += step.durationMs
        prev.leftAt = step.leftAt
        continue
      }
      merged.push(step)
    }

    const steps = merged.map(({ sortAt: _sortAt, ...step }) => step)

    return { sessionId, steps }
  },
}
