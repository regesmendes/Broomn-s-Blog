import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface MediaCdnStackProps extends StackProps {
  /** The media S3 bucket (storage-stack.ts) */
  mediaBucket: s3.IBucket;
  /** Route53 Hosted Zone ID for the domain */
  hostedZoneId: string;
  /** Root domain name (blogdobroomn.com) */
  domainName: string;
  /** Email address to notify when the CloudFront+S3 cost budget is breached */
  budgetAlertEmail: string;
  /** Monthly cost budget limit in USD, covering CloudFront + S3 */
  budgetMonthlyLimitUsd: number;
}

/**
 * Media CDN Stack - dedicated CloudFront distribution fronting the media S3
 * bucket, on its own subdomain (media.blogdobroomn.com).
 *
 * Deliberately a separate distribution from FrontendStack's, not a new
 * behavior on it: S3 keys are bare `<uuid>.<ext>` at the bucket root with no
 * path prefix to route a behavior pattern on, and the deploy pipeline already
 * runs a full `/*` invalidation against the frontend distribution on every
 * app deploy (docs/deployment.md) — sharing it would flush the entire media
 * cache on every single app deploy, defeating the point of a long TTL.
 *
 * The bucket is CloudFront-only via Origin Access Control (issue #87 Part B
 * item 9 — locked down after the media URL backfill confirmed nothing in the
 * app itself still referenced the old direct-S3 URLs; see storage-stack.ts).
 * The origin below deliberately passes an *imported* reference to the bucket
 * (`s3.Bucket.fromBucketName`), not the live `props.mediaBucket` construct:
 * `S3BucketOrigin.withOriginAccessControl` unconditionally tries to write a
 * bucket-policy grant via `bucket.addToResourcePolicy(...)`, scoped to
 * *this* distribution's own ID — which only exists once this stack's
 * `Distribution` is bound. If that write targeted the real bucket construct
 * (owned by StorageStack), it would create a StorageStack <-> MediaCdnStack
 * circular dependency, confirmed by a failing synth when this was first
 * tried. `addToResourcePolicy` on an *imported* bucket is a documented CDK
 * no-op instead (just a synth-time warning annotation) — the real, only
 * policy statement for this bucket is written directly in storage-stack.ts,
 * scoped to this distribution's actual (already-known, stable) ARN as a
 * plain string literal, sidestepping the cross-stack token entirely. See
 * aws-cdk-lib's aws-cloudfront-origins README, "Setting up OAC with
 * imported S3 buckets".
 *
 * No Origin Request Policy forwarding/varying on `Origin`: every image on
 * this site renders via a plain `<img src>` with no `crossorigin` attribute
 * (TranslatablePostCard.tsx, posts/[slug]/page.tsx), so no CORS request is
 * ever sent for these images in the first place — there's no CORS response
 * to poison by varying the cache key on `Origin`, and doing so would also
 * conflict with CACHING_OPTIMIZED, which includes no headers in the cache
 * key at all. CORS headers are attached anyway via a *static* Response
 * Headers Policy, for future-proofing, since that's safe for public images.
 */
export class MediaCdnStack extends Stack {
  /** CloudFront distribution ID (needed for cache invalidation on delete) */
  public readonly distributionId: string;
  /** The domain name serving media (media.blogdobroomn.com) */
  public readonly domainNameOutput: string;
  /** The distribution ARN (for scoping the API Lambda's invalidation permission) */
  public readonly distributionArn: string;

  constructor(scope: Construct, id: string, props: MediaCdnStackProps) {
    super(scope, id, props);

    const mediaDomain = `media.${props.domainName}`;

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    // ACM certificate for the media subdomain (must be in us-east-1 for CloudFront)
    const certificate = new acm.Certificate(this, 'MediaCertificate', {
      domainName: mediaDomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Imported, not props.mediaBucket directly — see the class doc comment
    // above for why this specific distinction matters here.
    const importedMediaBucket = s3.Bucket.fromBucketName(
      this,
      'ImportedMediaBucketForOac',
      props.mediaBucket.bucketName,
    );
    const origin = cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(importedMediaBucket);

    // CORS allow-all (safe for public images) + nosniff, since upload
    // content-type is client-declared with no magic-byte verification
    // (ALLOWED_MIME_TYPES check in media.routes.ts) — SVG is already
    // excluded there, keep it that way, since SVG on a same-site subdomain
    // would be a stored-XSS vector.
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'MediaResponseHeadersPolicy', {
      responseHeadersPolicyName: 'broomns-blog-media-headers',
      comment: "Broomn's Blog - Media CDN response headers (static CORS + nosniff)",
      corsBehavior: {
        accessControlAllowOrigins: ['*'],
        accessControlAllowHeaders: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD'],
        accessControlAllowCredentials: false,
        originOverride: true,
      },
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
      },
    });

    // Rate-based WAF rule — a basic backstop against hotlinking/scraping
    // abuse (the other half of this backstop is the Budgets alarm below).
    // Must be created in us-east-1 with CLOUDFRONT scope (this stack's
    // region already matches). 300s is AWS WAFv2's standard rate-based
    // evaluation window ("N requests per 5 minutes per IP" per issue #87).
    const webAcl = new wafv2.CfnWebACL(this, 'MediaWebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'broomns-blog-media-web-acl',
      },
      rules: [
        {
          name: 'RateLimitPerIp',
          priority: 1,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              evaluationWindowSec: 300,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'broomns-blog-media-rate-limit',
          },
        },
      ],
    });

    const distribution = new cloudfront.Distribution(this, 'MediaDistribution', {
      comment: "Broomn's Blog - Media CDN",
      domainNames: [mediaDomain],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      // Despite the property name, this takes the WebACL's ARN, not its ID.
      webAclId: webAcl.attrArn,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        // Safe with a long default/max TTL: item 6 (active invalidation on
        // delete) removes the staleness window a purely TTL-based approach
        // would otherwise carry, and media URLs are immutable — every
        // upload gets a brand-new crypto.randomUUID() key, nothing ever
        // re-uploads bytes to an existing key (confirmed in media.routes.ts).
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy,
        compress: true,
      },
    });

    // Route53 A record: media.blogdobroomn.com → CloudFront
    new route53.ARecord(this, 'MediaARecord', {
      zone: hostedZone,
      recordName: 'media',
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution),
      ),
    });

    this.distributionId = distribution.distributionId;
    this.domainNameOutput = mediaDomain;
    this.distributionArn = `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`;

    // A CDN makes high-volume scraping/hotlinking of public media both cheap
    // for an attacker and metered, uncapped cost for this account (the WAF
    // rate limit below is the other half of this backstop). No Budgets
    // construct existed anywhere in this app before this stack.
    const budgetAlertTopic = new sns.Topic(this, 'BudgetAlertTopic', {
      topicName: 'broomns-blog-budget-alerts',
    });
    budgetAlertTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(props.budgetAlertEmail),
    );
    // Budgets (unlike most services) needs an explicit resource policy
    // statement to publish to an SNS topic — without this the notification
    // silently never arrives.
    budgetAlertTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('budgets.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [budgetAlertTopic.topicArn],
      }),
    );

    const budgetNotification = (
      notificationType: 'ACTUAL' | 'FORECASTED',
      threshold: number,
    ): budgets.CfnBudget.NotificationWithSubscribersProperty => ({
      notification: {
        notificationType,
        comparisonOperator: 'GREATER_THAN',
        threshold,
        thresholdType: 'PERCENTAGE',
      },
      subscribers: [{ subscriptionType: 'SNS', address: budgetAlertTopic.topicArn }],
    });

    new budgets.CfnBudget(this, 'CdnCostBudget', {
      budget: {
        budgetName: 'broomns-blog-cloudfront-s3',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
          amount: props.budgetMonthlyLimitUsd,
          unit: 'USD',
        },
        // Covers the CDN + the bucket it fronts, at minimum — the two
        // services a hotlinking/scraping spike would actually run up.
        costFilters: {
          Service: ['Amazon CloudFront', 'Amazon Simple Storage Service'],
        },
      },
      notificationsWithSubscribers: [
        budgetNotification('ACTUAL', 80),
        budgetNotification('ACTUAL', 100),
        budgetNotification('FORECASTED', 100),
      ],
    });

    // CloudFormation Outputs
    new CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'Media CloudFront Distribution ID (MEDIA_DISTRIBUTION_ID for the API Lambda)',
    });

    new CfnOutput(this, 'MediaDomainName', {
      value: mediaDomain,
      description: 'Media CDN domain (MEDIA_CDN_URL for the API Lambda)',
    });
  }
}
