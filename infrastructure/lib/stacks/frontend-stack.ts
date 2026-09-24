import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';

export interface FrontendStackProps extends StackProps {
  /** Route53 Hosted Zone ID for the domain */
  hostedZoneId: string;
  /** Root domain name (blogdobroomn.com) */
  domainName: string;
}

/**
 * Frontend Stack - static "sunset" page: S3 (single index.html) + CloudFront.
 *
 * The app is sunset (see docs/disaster-recovery.md's "Resurrection runbook").
 * This used to serve the live Next.js app via OpenNext (Lambda + S3 +
 * CloudFront) — that setup is preserved in git history (see the runbook) for
 * reactivation later. `frontend/` itself (the Next.js source) is untouched,
 * just no longer deployed.
 *
 * Content lives at infrastructure/assets/sunset-site/index.html, synced to
 * the bucket root by deploy.yml (no build step — plain static HTML). Every
 * path serves the same page: CloudFront's errorResponses maps S3's 403/404
 * (any key other than index.html) back to /index.html with a 200.
 *
 * ACM certificate for HTTPS; Route53 A record points blogdobroomn.com → CloudFront.
 */
export class FrontendStack extends Stack {
  /** CloudFront distribution ID (needed for cache invalidation during deploys) */
  public readonly distributionId: string;
  /** The domain name serving the frontend */
  public readonly domainNameOutput: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const siteDomain = props.domainName;

    // S3 bucket for the static sunset page (private — served via CloudFront OAC).
    // Content is synced to the bucket root by deploy.yml:
    //   aws s3 sync infrastructure/assets/sunset-site s3://<bucket> --delete
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `broomns-blog-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Look up the hosted zone for DNS records
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    // ACM certificate for the site domain (must be in us-east-1 for CloudFront)
    const certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: siteDomain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const siteOrigin = cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(siteBucket);

    // Single distribution, single static page: every path CloudFront doesn't
    // find in S3 (i.e. every path except /index.html) comes back as a 403
    // from OAC-protected S3, which errorResponses below rewrites to the same
    // page with a 200 — so any URL on the domain shows the sunset message.
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: "Broomn's Blog - Sunset page",
      domainNames: [siteDomain],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: siteOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // Route53 A record: blogdobroomn.com → CloudFront
    new route53.ARecord(this, 'SiteARecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution),
      ),
    });

    // Google Search Console domain verification. A DNS TXT record, not an
    // HTTP-based method (meta tag / GA snippet) — those both fail here since
    // next-intl's locale-redirect middleware sends the bare apex domain to
    // /pt with an empty body before any page ever renders, and Google's
    // verifier deliberately does not follow redirects when checking site
    // ownership (otherwise a redirect to someone else's tagged site would
    // "verify" ownership of this domain).
    new route53.TxtRecord(this, 'GoogleSiteVerification', {
      zone: hostedZone,
      values: ['google-site-verification=gAUjhnUNhnqGXHszsBrzX3y7biCncLa6eVx5fp7jv-c'],
    });

    // Store references for cross-stack usage
    this.distributionId = distribution.distributionId;
    this.domainNameOutput = siteDomain;

    // CloudFormation Outputs
    new CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID (use for cache invalidation)',
    });

    new CfnOutput(this, 'DomainName', {
      value: siteDomain,
      description: 'Frontend domain name',
    });

    new CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
      description: 'Frontend S3 bucket (sync infrastructure/assets/sunset-site to the bucket root)',
    });

    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });
  }
}
