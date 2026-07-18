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
 * Frontend Stack - S3 + CloudFront for static site hosting.
 *
 * Uses Origin Access Control (OAC) to keep the S3 bucket private while
 * serving content through CloudFront. ACM certificate for HTTPS.
 * Route53 A record points blogdobroomn.com → CloudFront.
 */
export class FrontendStack extends Stack {
  /** CloudFront distribution ID (needed for cache invalidation during deploys) */
  public readonly distributionId: string;
  /** The domain name serving the frontend */
  public readonly domainNameOutput: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const siteDomain = props.domainName;

    // S3 bucket for static frontend assets (private — served via CloudFront OAC)
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

    // CloudFront distribution with S3 OAC origin
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: "Broomn's Blog - Frontend",
      defaultRootObject: 'index.html',
      domainNames: [siteDomain],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // SPA fallback: return index.html for 403/404 (client-side routing)
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Route53 A record: blogdobroomn.com → CloudFront
    new route53.ARecord(this, 'SiteARecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution),
      ),
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
      description: 'Frontend S3 bucket (deploy static assets here)',
    });

    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });
  }
}
