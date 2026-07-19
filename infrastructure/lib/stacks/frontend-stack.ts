import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
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
 * Frontend Stack - Next.js SSR via OpenNext: Lambda (server) + S3 (assets) + CloudFront.
 *
 * The app is built with `npx open-next build` (see frontend/.open-next/), which
 * produces:
 *   - a self-contained server Lambda bundle (.open-next/server-functions/default)
 *     that renders every page (all routes are force-dynamic SSR — no ISR/SSG,
 *     so no SQS revalidation queue or DynamoDB tag cache is provisioned; see
 *     frontend/open-next.config.ts)
 *   - static assets (.open-next/assets) that must be synced to the S3 bucket
 *     under the `_assets/` prefix (the CloudFront S3 origin uses originPath
 *     `/_assets`, per OpenNext's open-next.output.json manifest)
 *
 * CloudFront routes `_next/static/*` and the public files to S3 (OAC, private
 * bucket) and everything else to the server Lambda via a Function URL (also
 * OAC-protected — the URL only accepts CloudFront-signed requests). A Function
 * URL works directly because OpenNext's default aws-lambda wrapper expects the
 * API Gateway HTTP API v2 event shape, which Function URLs share.
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

    // Repo root (frontend/.open-next lives outside infrastructure/)
    const repoRoot = path.join(__dirname, '..', '..', '..');
    const openNextDir = path.join(repoRoot, 'frontend', '.open-next');

    // S3 bucket for static frontend assets (private — served via CloudFront OAC).
    // OpenNext assets are synced to the `_assets/` prefix after deploy:
    //   aws s3 sync frontend/.open-next/assets s3://<bucket>/_assets --delete
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `broomns-blog-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Next.js SSR server function. The OpenNext bundle is fully self-contained
    // (handler + node_modules already packaged), so no esbuild/CDK bundling is
    // needed — unlike the API Lambda in api-stack.ts.
    const serverFunction = new lambda.Function(this, 'ServerFn', {
      functionName: 'broomns-blog-frontend-server',
      runtime: lambda.Runtime.NODEJS_24_X,
      code: lambda.Code.fromAsset(path.join(openNextDir, 'server-functions', 'default')),
      handler: 'index.handler',
      memorySize: 1024,
      timeout: Duration.seconds(30),
      environment: {
        NEXT_PUBLIC_API_URL: 'https://api.blogdobroomn.com',
      },
    });

    // Function URL with IAM auth — CloudFront signs origin requests via OAC,
    // so the URL is not publicly invocable outside the distribution.
    const serverFunctionUrl = serverFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
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

    // S3 origin: assets live under the `_assets/` prefix (OpenNext convention)
    const assetsOrigin = cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
      originPath: '/_assets',
    });

    // Lambda origin: SSR server function. The viewer's Host header must NOT be
    // forwarded (a Function URL only accepts its own hostname), hence
    // ALL_VIEWER_EXCEPT_HOST_HEADER below. OpenNext restores the real host
    // from x-forwarded-host — which CloudFront does not set by itself, so a
    // viewer-request CloudFront Function copies Host into it. Without this,
    // redirects (e.g. next-intl's / → /pt) would point at the Lambda URL.
    const serverOrigin = cloudfrontOrigins.FunctionUrlOrigin.withOriginAccessControl(
      serverFunctionUrl,
    );

    const forwardHostFunction = new cloudfront.Function(this, 'ForwardHostFn', {
      comment: 'Copies Host into x-forwarded-host for the SSR Lambda',
      code: cloudfront.FunctionCode.fromInline(
        'function handler(event) {\n' +
        '  var request = event.request;\n' +
        '  request.headers["x-forwarded-host"] = { value: request.headers.host.value };\n' +
        '  return request;\n' +
        '}',
      ),
    });

    // SSR responses must never be cached by CloudFront (every route is
    // force-dynamic), but the cache policy still controls which values are
    // visible to the origin — CACHING_DISABLED + ALL_VIEWER_EXCEPT_HOST_HEADER
    // passes cookies, query strings and headers through untouched.
    const serverBehavior: cloudfront.BehaviorOptions = {
      origin: serverOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      functionAssociations: [
        {
          function: forwardHostFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        },
      ],
      compress: true,
    };

    // Static asset behavior: immutable hashed files, cache aggressively
    const staticBehavior: cloudfront.BehaviorOptions = {
      origin: assetsOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      compress: true,
    };

    // CloudFront distribution. Behavior patterns follow OpenNext's manifest
    // (frontend/.open-next/open-next.output.json): static files → S3, every
    // other path → server Lambda. No SPA errorResponses — a real 404 is
    // rendered by the Next.js app itself.
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: "Broomn's Blog - Frontend",
      domainNames: [siteDomain],
      certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: serverBehavior,
      additionalBehaviors: {
        // Order matters: `_next/data/*` (dynamic) must outrank `_next/*` (static)
        '_next/data/*': serverBehavior,
        '_next/*': staticBehavior,
        'BUILD_ID': staticBehavior,
        'favicon.png': staticBehavior,
        'images/*': staticBehavior,
        '*.svg': staticBehavior,
      },
    });

    // Since October 2025, Lambda's Function URL auth layer requires the
    // resource policy to grant BOTH lambda:InvokeFunctionUrl AND
    // lambda:InvokeFunction for CloudFront OAC-signed requests.
    // FunctionUrlOrigin.withOriginAccessControl only grants the former
    // (aws-cdk-lib 2.254.0), so without this extra grant CloudFront gets a
    // 403 "Function URL authorization" error from every origin request.
    serverFunction.addPermission('AllowCloudFrontInvokeFunction', {
      principal: new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
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
      description: 'Frontend S3 bucket (sync .open-next/assets to the _assets/ prefix)',
    });

    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });

    new CfnOutput(this, 'ServerFunctionName', {
      value: serverFunction.functionName,
      description: 'Next.js SSR server Lambda function name',
    });
  }
}
