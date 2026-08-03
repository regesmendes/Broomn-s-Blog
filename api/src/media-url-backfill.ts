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
 * Covers `contentEn` on all three content tables too, alongside `content`.
 * Issue #87's original plan deferred `contentEn` to a second, later, narrower
 * sweep, specifically because Part A (manual bilingual authoring) might not
 * have shipped yet when this ran, and even once it had, most content
 * wouldn't be translated yet. By the time this actually shipped, both had
 * already happened — a meaningful amount of content was manually translated
 * before this backfill ever ran — so the reason for a second pass no longer
 * applied, and splitting it in two would just have meant two dry-runs, two
 * snapshots, two production runs for no benefit. Collapsed into one pass.
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

  type ContentRow = { content: string; contentEn: string | null }

  // Matches a row whose PT or EN body still references the old origin —
  // used identically for all three content tables below.
  const contentOrEnMatches = {
    OR: [{ content: { contains: oldOrigin } }, { contentEn: { contains: oldOrigin } }],
  }

  const [mediaRows, coverImageRows, postContentRows, aboutRows, supportRows] = await Promise.all([
    prisma.media.findMany({ where: { url: { startsWith: oldOrigin } } }),
    prisma.post.findMany({
      where: { coverImage: { startsWith: oldOrigin } },
      select: { id: true, coverImage: true },
    }),
    prisma.post.findMany({
      where: contentOrEnMatches,
      select: { id: true, content: true, contentEn: true },
    }),
    prisma.aboutPage.findMany({
      where: contentOrEnMatches,
      select: { id: true, content: true, contentEn: true },
    }),
    prisma.supportPage.findMany({
      where: contentOrEnMatches,
      select: { id: true, content: true, contentEn: true },
    }),
  ])

  const enMatchCount = (rows: ContentRow[]) =>
    rows.filter((r) => r.contentEn?.includes(oldOrigin)).length

  const summary = {
    oldOrigin,
    newOrigin,
    mediaRows: mediaRows.length,
    postCoverImageRows: coverImageRows.length,
    postContentRows: postContentRows.length,
    postContentEnMatches: enMatchCount(postContentRows),
    aboutPageRows: aboutRows.length,
    aboutPageContentEnMatches: enMatchCount(aboutRows),
    supportPageRows: supportRows.length,
    supportPageContentEnMatches: enMatchCount(supportRows),
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
    ...postContentRows.map((p: ContentRow & { id: string }) =>
      prisma.post.update({
        where: { id: p.id },
        data: { content: rewrite(p.content), ...(p.contentEn && { contentEn: rewrite(p.contentEn) }) },
      })
    ),
    ...aboutRows.map((a: ContentRow & { id: string }) =>
      prisma.aboutPage.update({
        where: { id: a.id },
        data: { content: rewrite(a.content), ...(a.contentEn && { contentEn: rewrite(a.contentEn) }) },
      })
    ),
    ...supportRows.map((s: ContentRow & { id: string }) =>
      prisma.supportPage.update({
        where: { id: s.id },
        data: { content: rewrite(s.content), ...(s.contentEn && { contentEn: rewrite(s.contentEn) }) },
      })
    ),
  ])

  console.log('Backfill complete:', JSON.stringify(summary, null, 2))
  return { statusCode: 200, dryRun: false, summary }
}
