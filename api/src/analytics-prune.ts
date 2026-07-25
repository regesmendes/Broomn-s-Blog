import { getDatabaseUrl } from './lib/dbCredentials'

const RETENTION_DAYS = 180

let initialized = false

/**
 * Scheduled Lambda: prunes RequestLog/PageView rows older than the 180-day
 * retention window. Runs daily (see infrastructure's AnalyticsPruneSchedule).
 */
export const handler = async () => {
  if (!initialized) {
    // Must resolve before anything that touches lib/prisma.ts is required —
    // PrismaClient reads DATABASE_URL at construction time (same pattern as
    // lambda.ts, see the comment there).
    process.env.DATABASE_URL = await getDatabaseUrl()
    initialized = true
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { analyticsRepository } = require('./repositories/analytics.repository')

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const pruned = await analyticsRepository.pruneOlderThan(cutoff)

  console.log(
    `Pruned analytics rows older than ${cutoff.toISOString()}: ` +
      `${pruned.requestLogs} request logs, ${pruned.pageViews} page views`
  )
  return pruned
}
