import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

// The already-deployed media CloudFront distribution's ARN (BromnBlog-MediaCdn,
// media.blogdobroomn.com). Hardcoded as a literal rather than threaded in as a
// cross-stack prop: MediaCdnStack's origin needs this bucket, and if this
// stack's bucket policy needed MediaCdnStack's live distribution ID/ARN back,
// the two stacks would mutually depend on each other — CDK (and CloudFormation
// deploy ordering) cannot resolve that cycle. Since the distribution already
// exists and its ID is permanent, there's nothing to keep in sync by wiring it
// as a token; see media-cdn-stack.ts's own comment for the other half of this.
const MEDIA_DISTRIBUTION_ARN = 'arn:aws:cloudfront::099710233970:distribution/E1WND5038XU2PX';

/**
 * Storage Stack - S3 buckets for media uploads and backups.
 *
 * Media bucket: CORS for the blog domain, versioned (protects against an
 * accidental overwrite/delete of a single object — see
 * docs/disaster-recovery.md), and lifecycle rules to clean up incomplete
 * multipart uploads and old noncurrent versions. Read access is
 * CloudFront-only (Origin Access Control) — locked down as of issue #87 Part
 * B item 9, after the media URL backfill confirmed nothing in the app itself
 * still referenced the old direct-S3 URLs. See "Media served via a dedicated
 * CloudFront distribution" in docs/architecture.md for the full story,
 * including the one accepted, permanent cost of this lockdown (broken images
 * in newsletter emails already sent).
 *
 * Backup bucket: private (no public access at all), holds periodic exports
 * that back up state CDK itself can't reproduce (e.g. Cognito users — see
 * cognito-export Lambda in api-stack.ts). Deliberately a separate bucket from
 * the media one.
 */
export class StorageStack extends Stack {
  /** The media bucket name */
  public readonly bucketName: string;
  /** The media bucket ARN */
  public readonly bucketArn: string;
  /** The S3 bucket construct */
  public readonly mediaBucket: s3.IBucket;
  /** The private backups bucket name */
  public readonly backupBucketName: string;
  /** The private backups bucket ARN */
  public readonly backupBucketArn: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 bucket for blog media uploads (post images, covers, etc.)
    const mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `broomns-blog-media-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: [
            'https://blogdobroomn.com',
            'http://localhost:3000', // Local development
          ],
          exposedHeaders: ['ETag'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          // Clean up incomplete multipart uploads after 1 day
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
        {
          // Versioning alone grows storage unboundedly on every overwrite —
          // bound it, since only the current version needs to survive long-term
          noncurrentVersionExpiration: Duration.days(90),
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
    });

    // CloudFront-only read access via Origin Access Control — the bucket
    // itself is otherwise fully private (BlockPublicAccess.BLOCK_ALL above).
    // MediaCdnStack's origin uses an *imported* reference to this same bucket
    // (not this live construct) specifically so its own OAC wiring doesn't
    // try to write a second, conflicting policy statement onto this resource
    // from the other stack — see media-cdn-stack.ts's comment. This is the
    // one and only place this bucket's access policy is actually defined.
    mediaBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${mediaBucket.bucketArn}/*`],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        conditions: {
          StringEquals: { 'AWS:SourceArn': MEDIA_DISTRIBUTION_ARN },
        },
      }),
    );

    // Private backups bucket — no public access, holds e.g. Cognito user
    // exports. Never reuse the media bucket for this: it has a public-read
    // policy above, which would expose user PII.
    const backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName: `broomns-blog-backups-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        {
          // Bound storage growth — exports are periodic snapshots, not a
          // permanent archive
          expiration: Duration.days(365),
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Store references for cross-stack usage
    this.bucketName = mediaBucket.bucketName;
    this.bucketArn = mediaBucket.bucketArn;
    this.mediaBucket = mediaBucket;
    this.backupBucketName = backupBucket.bucketName;
    this.backupBucketArn = backupBucket.bucketArn;

    // CloudFormation Outputs
    new CfnOutput(this, 'BucketName', {
      value: mediaBucket.bucketName,
      description: 'Media uploads S3 bucket name',
    });

    new CfnOutput(this, 'BucketArn', {
      value: mediaBucket.bucketArn,
      description: 'Media uploads S3 bucket ARN',
    });

    new CfnOutput(this, 'BucketDomainName', {
      value: mediaBucket.bucketRegionalDomainName,
      description: 'S3 bucket regional domain name for serving media',
    });

    new CfnOutput(this, 'BackupBucketName', {
      value: backupBucket.bucketName,
      description: 'Private backups bucket name (Cognito exports, etc.)',
    });
  }
}
