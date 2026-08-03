import { getDatabaseUrl } from './lib/dbCredentials'

interface BackfillEvent {
  /** Old media origin to rewrite, e.g. https://broomns-blog-media-<account>.s3.us-east-1.amazonaws.com. Defaults to the direct S3 URL this Lambda's own env vars point at. */
  oldOrigin?: string
  /** New media origin (the CDN), e.g. https://media.blogdobroomn.com. Defaults to MEDIA_CDN_URL. */
  newOrigin?: string
  /** Defaults to true — must be explicitly set to false to write anything. */
  dryRun?: boolean
}

let initialized = false

/**
 * On-demand Lambda: rewrites old direct-S3 media URLs to the new CDN origin
 * across Media.url, Post.coverImage, and Post/AboutPage/SupportPage.content
 * (issue #87 Part B item 5). Not wired to any trigger — invoke manually:
 *
 *   aws lambda invoke --function-name broomns-blog-media-url-backfill --region us-east-1 \
 *     --cli-binary-format raw-in-base64-out --payload '{"dryRun":true}' /dev/stdout
 *
 * Defaults to a dry run (counts + a sample of matched URLs, no writes) —
 * pass `"dryRun":false` only after reviewing that output and taking an RDS
 * snapshot (see docs/deployment.md).
 *
 * Deliberately excludes `contentEn` on all three content tables. Part A
 * (manual bilingual authoring) may not have shipped yet, and even once it
 * has, most content won't be translated yet, so there's little to rewrite
 * there and no reason to make this backfill wait on it. Any `contentEn`
 * populated after this backfill runs already references the new CDN URL
 * (translated from PT content this backfill already rewrote) — the residual
 * case, `contentEn` translated *before* this ran, still holding an old-style
 * URL, needs its own later, narrower sweep once Part A has shipped and some
 * translation has happened (see the "Cross-cutting: sequencing" section of
 * issue #87) — reuse this same rewrite logic, scoped to just the `contentEn`
 * columns, at that point rather than extending this script now.
 *
 * Idempotent: the WHERE/filter clauses only match rows still containing
 * `oldOrigin`, so a row already rewritten (or one that never had the old URL)
 * is never touched — safe to re-run after a partial failure.
 */
export const handler = async (event: BackfillEvent = {}) => {
  if (!initialized) {
    // Must resolve before anything that touches lib/prisma.ts is required —
    // PrismaClient reads DATABASE_URL at construction time.
    process.env.DATABASE_URL = await getDatabaseUrl()
    initialized = true
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { prisma } = require('./lib/prisma')

  const oldOrigin =
    event.oldOrigin ??
    (process.env.S3_BUCKET_NAME
      ? `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION_NAME ?? 'us-east-1'}.amazonaws.com`
      : undefined)
  const newOrigin = event.newOrigin ?? process.env.MEDIA_CDN_URL
  const dryRun = event.dryRun !== false

  if (!oldOrigin || !newOrigin) {
    throw new Error(
      'Could not resolve oldOrigin/newOrigin — pass them explicitly, or ensure S3_BUCKET_NAME and MEDIA_CDN_URL are set'
    )
  }

  const rewrite = (value: string) => value.split(oldOrigin).join(newOrigin)

  const [mediaRows, coverImageRows, postContentRows, aboutRows, supportRows] = await Promise.all([
    prisma.media.findMany({ where: { url: { startsWith: oldOrigin } } }),
    prisma.post.findMany({
      where: { coverImage: { startsWith: oldOrigin } },
      select: { id: true, coverImage: true },
    }),
    prisma.post.findMany({
      where: { content: { contains: oldOrigin } },
      select: { id: true, content: true },
    }),
    prisma.aboutPage.findMany({
      where: { content: { contains: oldOrigin } },
      select: { id: true, content: true },
    }),
    prisma.supportPage.findMany({
      where: { content: { contains: oldOrigin } },
      select: { id: true, content: true },
    }),
  ])

  const summary = {
    oldOrigin,
    newOrigin,
    mediaRows: mediaRows.length,
    postCoverImageRows: coverImageRows.length,
    postContentRows: postContentRows.length,
    aboutPageRows: aboutRows.length,
    supportPageRows: supportRows.length,
    // A sample of actual matched URLs, so an admin can eyeball whether the
    // assumed URL shape covers everything, or whether production holds some
    // other shape this prefix match would silently miss.
    sampleMediaUrls: mediaRows.slice(0, 5).map((m: { url: string }) => m.url),
  }

  if (dryRun) {
    console.log('DRY RUN — no changes made:', JSON.stringify(summary, null, 2))
    return { statusCode: 200, dryRun: true, summary }
  }

  // Media.url and the content columns referencing it are rewritten together:
  // PATCH /media/:id/replace matches on the exact Media.url string, and
  // would break if it and the content columns diverged mid-migration.
  await prisma.$transaction([
    ...mediaRows.map((m: { id: string; url: string }) =>
      prisma.media.update({ where: { id: m.id }, data: { url: rewrite(m.url) } })
    ),
    ...coverImageRows.map((p: { id: string; coverImage: string }) =>
      prisma.post.update({ where: { id: p.id }, data: { coverImage: rewrite(p.coverImage) } })
    ),
    ...postContentRows.map((p: { id: string; content: string }) =>
      prisma.post.update({ where: { id: p.id }, data: { content: rewrite(p.content) } })
    ),
    ...aboutRows.map((a: { id: string; content: string }) =>
      prisma.aboutPage.update({ where: { id: a.id }, data: { content: rewrite(a.content) } })
    ),
    ...supportRows.map((s: { id: string; content: string }) =>
      prisma.supportPage.update({ where: { id: s.id }, data: { content: rewrite(s.content) } })
    ),
  ])

  console.log('Backfill complete:', JSON.stringify(summary, null, 2))
  return { statusCode: 200, dryRun: false, summary }
}
