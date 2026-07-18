/**
 * OpenNext build configuration.
 *
 * Every page in this app is `export const dynamic = 'force-dynamic'` — there
 * is no ISR/SSG revalidation at all. Disabling the incremental cache and tag
 * cache makes the server Lambda skip its cache adapter entirely, which means
 * we don't have to provision the SQS revalidation queue, the DynamoDB tag
 * table, or an S3 cache prefix that OpenNext would otherwise expect.
 *
 * (Shape: OpenNextConfig from open-next/dist/types/open-next.d.ts — the type
 * isn't importable through the package's exports map, so it's left untyped.)
 */
const config = {
  default: {},
  dangerous: {
    // ISR/SSG cache — unused (all routes are force-dynamic SSR)
    disableIncrementalCache: true,
    // revalidateTag/revalidatePath — unused
    disableTagCache: true,
  },
};

export default config;
