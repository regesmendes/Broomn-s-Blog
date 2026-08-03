import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'
import { randomUUID } from 'crypto'

// Media distribution ID (infrastructure/lib/stacks/media-cdn-stack.ts, wired
// through api-stack.ts). Unset in local dev — invalidation is skipped
// entirely rather than erroring, since there's no distribution to invalidate.
const distributionId = process.env.MEDIA_DISTRIBUTION_ID

const cloudfrontClient = new CloudFrontClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

/**
 * Invalidates a single media object's path at the edge after it's deleted.
 * Media URLs are immutable (a fresh crypto.randomUUID() key every upload —
 * see lib/s3.ts), so this is the only case a cached copy can go stale: once
 * the S3 object itself is gone, keeping the long CACHING_OPTIMIZED TTL means
 * an edge location could otherwise keep serving a deleted image indefinitely.
 */
export async function invalidateMediaPath(key: string): Promise<void> {
  if (!distributionId) return

  await cloudfrontClient.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: randomUUID(),
        Paths: {
          Quantity: 1,
          Items: [`/${key}`],
        },
      },
    })
  )
}
