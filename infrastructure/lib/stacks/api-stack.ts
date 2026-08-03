import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';

export interface ApiStackProps extends StackProps {
  /** VPC for Lambda to access Aurora */
  vpc: ec2.IVpc;
  /** Security group for Lambda (allows DB access) */
  lambdaSecurityGroup: ec2.ISecurityGroup;
  /** Aurora cluster endpoint (host:port) */
  dbInstance: rds.DatabaseInstance;
  /** Cognito User Pool ID */
  userPoolId: string;
  /** Cognito User Pool ARN */
  userPoolArn: string;
  /** Cognito App Client ID */
  userPoolClientId: string;
  /** Cognito Domain */
  cognitoDomain: string;
  /** S3 media bucket name */
  mediaBucketName: string;
  /** S3 media bucket ARN */
  mediaBucketArn: string;
  /** Private backups bucket name */
  backupBucketName: string;
  /** Private backups bucket ARN */
  backupBucketArn: string;
  /** Media CDN domain name (media-cdn-stack.ts, e.g. media.blogdobroomn.com) */
  mediaCdnDomain: string;
  /** Media CDN CloudFront distribution ID (media-cdn-stack.ts) */
  mediaDistributionId: string;
  /** Media CDN CloudFront distribution ARN, for scoping the invalidation IAM permission */
  mediaDistributionArn: string;
  /** Route53 Hosted Zone ID for the domain */
  hostedZoneId: string;
  /** Root domain name (blogdobroomn.com) */
  domainName: string;
}

/**
 * API Stack - Lambda function behind API Gateway HTTP API.
 *
 * Deploys the Fastify API as a single Lambda function with a proxy integration.
 * Lambda runs inside the VPC to reach Aurora, and has IAM permissions for S3 and SES.
 * Custom domain: api.blogdobroomn.com
 */
export class ApiStack extends Stack {
  /** The API Gateway URL */
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // DB credentials are deliberately NOT resolved/baked in here. The DB
    // secret rotates automatically every 90 days (database-stack.ts's
    // addRotationSingleUser) — baking the password into the Lambda's
    // environment at deploy time would leave it silently stale after the
    // first rotation. Instead, both Lambdas fetch it live at cold start via
    // api/src/lib/dbCredentials.ts, given just the secret's ARN plus the
    // stable host/port/name below (see docs/disaster-recovery.md).
    const dbSecret = props.dbInstance.secret!;

    // JWT signing secret for app-issued access/refresh tokens (also used for
    // the newsletter confirm/unsubscribe HMAC tokens). This was previously
    // unset entirely, which meant Fastify fell back to the literal string
    // 'change-me-in-production' baked into the source — anyone reading the
    // repo could forge a valid admin token. Generated once at deploy time;
    // rotating it (redeploy) invalidates all existing sessions.
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: 'broomns-blog/jwt-secret',
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: true,
      },
    });
    const jwtSecretValue = jwtSecret.secretValue.unsafeUnwrap();

    // Repo root: node_modules are hoisted here (npm workspaces), so esbuild
    // bundling and the lockfile resolution both need to start from there.
    const repoRoot = path.join(__dirname, '..', '..', '..');

    // Lambda function running the Fastify API, adapted via @fastify/aws-lambda.
    // Bundled with esbuild (NodejsFunction) since a plain dist/ asset doesn't
    // include node_modules — the Lambda zip must carry fastify, prisma, etc.
    const apiFunction = new NodejsFunction(this, 'ApiFn', {
      functionName: 'broomns-blog-api',
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(repoRoot, 'api', 'src', 'lambda.ts'),
      handler: 'handler',
      depsLockFilePath: path.join(repoRoot, 'package-lock.json'),
      memorySize: 512,
      timeout: Duration.seconds(30),
      vpc: props.vpc,
      // PRIVATE_WITH_EGRESS (routes through the VPC's existing NAT Gateway),
      // not PRIVATE_ISOLATED — this Lambda needs real internet egress to
      // reach SES (newsletter sending) and Cognito's JWKS endpoint (Google
      // OAuth token verification), neither of which is a VPC Gateway
      // Endpoint. PRIVATE_ISOLATED has zero route to 0.0.0.0/0, which meant
      // both of those calls would hang until the Lambda's own timeout killed
      // them. RDS is still reachable either way — that's same-VPC routing,
      // not internet egress.
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        // esbuild can't statically bundle Prisma's generated client (it's
        // dynamically loaded + ships a native query engine binary). Install
        // it as a real dependency in the bundle and copy the generated
        // client — including the rhel-openssl-3.0.x engine for Lambda's
        // Amazon Linux 2023 runtime — in alongside it.
        //
        // 'sharp' (lib/imageProcessing.ts) is listed here for the same
        // reason: it ships a platform/architecture-specific native binary
        // (the @img/sharp-<platform>-<arch> optional dependency actually
        // resolved into node_modules), which esbuild can't bundle either.
        // Since this Lambda's architecture is the CDK default (X86_64) and
        // its runtime is Amazon Linux (glibc, not musl), the resolved
        // package must be @img/sharp-linux-x64 — this only happens
        // automatically when `npm install` for this repo itself runs on a
        // linux-x64 host. Building from a different OS/architecture (e.g.
        // macOS, including Apple Silicon) silently bundles the wrong native
        // binary: it works in local dev (sharp still loads on the dev
        // machine's own platform) and only fails at runtime in Lambda. If
        // that happens, reinstall with the target platform forced before
        // building, e.g.: `npm install --os=linux --cpu=x64 sharp`.
        nodeModules: ['@prisma/client', 'sharp'],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            `rm -rf ${outputDir}/node_modules/.prisma`,
            `cp -r ${inputDir}/node_modules/.prisma ${outputDir}/node_modules/.prisma`,
          ],
        },
      },
      environment: {
        NODE_ENV: 'production',
        DB_SECRET_ARN: dbSecret.secretArn,
        DB_HOST: props.dbInstance.dbInstanceEndpointAddress,
        DB_PORT: props.dbInstance.dbInstanceEndpointPort,
        DB_NAME: 'broomnsblog',
        JWT_SECRET: jwtSecretValue,
        CORS_ORIGIN: `https://${props.domainName}`,
        COGNITO_USER_POOL_ID: props.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClientId,
        COGNITO_DOMAIN: props.cognitoDomain,
        S3_BUCKET_NAME: props.mediaBucketName,
        MEDIA_CDN_URL: `https://${props.mediaCdnDomain}`,
        MEDIA_DISTRIBUTION_ID: props.mediaDistributionId,
        AWS_REGION_NAME: 'us-east-1',
        API_URL: `https://api.${props.domainName}`,
        FRONTEND_URL: 'https://blogdobroomn.com',
        SES_FROM_EMAIL: 'noreply@blogdobroomn.com',
      },
    });

    // On-demand migration Lambda: runs `prisma migrate deploy` from inside the
    // VPC (the DB is only reachable from lambdaSecurityGroup). Not wired to any
    // trigger — invoke manually after deploying new migrations:
    //   aws lambda invoke --function-name broomns-blog-migrate --region us-east-1 /dev/stdout
    // NOTE: bundling requires node_modules/@prisma/engines/schema-engine-rhel-openssl-3.0.x
    // locally. If missing, fetch it with: node api/scripts/fetch-migrate-engine.js
    const migrateFunction = new NodejsFunction(this, 'MigrateFn', {
      functionName: 'broomns-blog-migrate',
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(repoRoot, 'api', 'src', 'migrate.ts'),
      handler: 'handler',
      depsLockFilePath: path.join(repoRoot, 'package-lock.json'),
      memorySize: 512,
      timeout: Duration.minutes(5),
      vpc: props.vpc,
      // PRIVATE_WITH_EGRESS, not PRIVATE_ISOLATED — same reason as apiFunction
      // above: this Lambda fetches DB credentials from Secrets Manager at cold
      // start (api/src/lib/dbCredentials.ts), and Secrets Manager has no VPC
      // Gateway Endpoint, so PRIVATE_ISOLATED left that call with no route out,
      // hanging until timeout. RDS is still reachable either way (same-VPC).
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        // Ship the real prisma CLI package (the handler shells out to it);
        // esbuild only bundles the thin handler wrapper.
        nodeModules: ['prisma'],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            // Schema/migration engine built for Lambda's Amazon Linux runtime
            `cp ${inputDir}/node_modules/@prisma/engines/schema-engine-rhel-openssl-3.0.x ${outputDir}/`,
            // The schema + migrations the CLI will apply
            `cp -r ${inputDir}/api/prisma ${outputDir}/prisma`,
            // Trim engines the CLI won't use (handler points at the copy above)
            `rm -f ${outputDir}/node_modules/@prisma/engines/schema-engine-* ${outputDir}/node_modules/@prisma/engines/libquery_engine-*`,
          ],
        },
      },
      environment: {
        DB_SECRET_ARN: dbSecret.secretArn,
        DB_HOST: props.dbInstance.dbInstanceEndpointAddress,
        DB_PORT: props.dbInstance.dbInstanceEndpointPort,
        DB_NAME: 'broomnsblog',
      },
    });

    // Needs the same DB secret read access as apiFunction, for the same
    // dynamic-fetch-at-cold-start reason (see dbCredentials.ts)
    migrateFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbSecret.secretArn],
      }),
    );

    new CfnOutput(this, 'MigrateFunctionName', {
      value: migrateFunction.functionName,
      description: 'Invoke this Lambda to run prisma migrate deploy against the live DB',
    });

    // Daily analytics retention prune: deletes RequestLog/PageView rows older
    // than 180 days (api/src/analytics-prune.ts). Uses Prisma Client directly
    // (lambda.ts's runtime-require pattern), so bundling mirrors apiFunction,
    // not migrateFunction's CLI-shell-out approach.
    const analyticsPruneFunction = new NodejsFunction(this, 'AnalyticsPruneFn', {
      functionName: 'broomns-blog-analytics-prune',
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(repoRoot, 'api', 'src', 'analytics-prune.ts'),
      handler: 'handler',
      depsLockFilePath: path.join(repoRoot, 'package-lock.json'),
      memorySize: 256,
      timeout: Duration.minutes(2),
      vpc: props.vpc,
      // PRIVATE_WITH_EGRESS, not PRIVATE_ISOLATED — same reason as
      // migrateFunction above: cold-start Secrets Manager fetch needs a route
      // out (see the 2026-07-23 incident note in docs/deployment.md).
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        // Same Prisma bundling story as apiFunction above
        nodeModules: ['@prisma/client'],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            `rm -rf ${outputDir}/node_modules/.prisma`,
            `cp -r ${inputDir}/node_modules/.prisma ${outputDir}/node_modules/.prisma`,
          ],
        },
      },
      environment: {
        DB_SECRET_ARN: dbSecret.secretArn,
        DB_HOST: props.dbInstance.dbInstanceEndpointAddress,
        DB_PORT: props.dbInstance.dbInstanceEndpointPort,
        DB_NAME: 'broomnsblog',
      },
    });

    analyticsPruneFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbSecret.secretArn],
      }),
    );

    new events.Rule(this, 'AnalyticsPruneSchedule', {
      schedule: events.Schedule.rate(Duration.days(1)),
      targets: [new eventsTargets.LambdaFunction(analyticsPruneFunction)],
    });

    // On-demand media URL backfill (api/src/media-url-backfill.ts, issue #87
    // Part B item 5): rewrites old direct-S3 media URLs to the CDN origin.
    // Not wired to any trigger — same manual-invoke pattern as migrateFunction,
    // and bundled like analyticsPruneFunction (real Prisma Client usage, not
    // a CLI shell-out). Defaults to a dry run; see the handler's own comment.
    const mediaUrlBackfillFunction = new NodejsFunction(this, 'MediaUrlBackfillFn', {
      functionName: 'broomns-blog-media-url-backfill',
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(repoRoot, 'api', 'src', 'media-url-backfill.ts'),
      handler: 'handler',
      depsLockFilePath: path.join(repoRoot, 'package-lock.json'),
      memorySize: 512,
      timeout: Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [props.lambdaSecurityGroup],
      bundling: {
        nodeModules: ['@prisma/client'],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            `rm -rf ${outputDir}/node_modules/.prisma`,
            `cp -r ${inputDir}/node_modules/.prisma ${outputDir}/node_modules/.prisma`,
          ],
        },
      },
      environment: {
        DB_SECRET_ARN: dbSecret.secretArn,
        DB_HOST: props.dbInstance.dbInstanceEndpointAddress,
        DB_PORT: props.dbInstance.dbInstanceEndpointPort,
        DB_NAME: 'broomnsblog',
        S3_BUCKET_NAME: props.mediaBucketName,
        MEDIA_CDN_URL: `https://${props.mediaCdnDomain}`,
        AWS_REGION_NAME: 'us-east-1',
      },
    });

    mediaUrlBackfillFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbSecret.secretArn],
      }),
    );

    new CfnOutput(this, 'MediaUrlBackfillFunctionName', {
      value: mediaUrlBackfillFunction.functionName,
      description: 'Invoke this Lambda to rewrite old direct-S3 media URLs to the CDN origin (dry run by default)',
    });

    new CfnOutput(this, 'AnalyticsPruneFunctionName', {
      value: analyticsPruneFunction.functionName,
      description: 'Daily Lambda pruning analytics rows past the 180-day retention window',
    });

    // Scheduled Cognito user export — the only piece of state CDK can't
    // reproduce (see docs/disaster-recovery.md). No VPC needed: it only
    // calls the Cognito and S3 public APIs, never touches RDS.
    const cognitoExportFunction = new NodejsFunction(this, 'CognitoExportFn', {
      functionName: 'broomns-blog-cognito-export',
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(repoRoot, 'api', 'src', 'cognito-export.ts'),
      handler: 'handler',
      depsLockFilePath: path.join(repoRoot, 'package-lock.json'),
      memorySize: 256,
      timeout: Duration.minutes(2),
      environment: {
        COGNITO_USER_POOL_ID: props.userPoolId,
        BACKUP_BUCKET_NAME: props.backupBucketName,
      },
    });

    cognitoExportFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:ListUsers'],
        resources: [props.userPoolArn],
      }),
    );

    cognitoExportFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject'],
        resources: [`${props.backupBucketArn}/cognito-exports/*`],
      }),
    );

    // Weekly cadence matches the ~1-week RPO accepted in docs/disaster-recovery.md
    new events.Rule(this, 'CognitoExportSchedule', {
      schedule: events.Schedule.rate(Duration.days(7)),
      targets: [new eventsTargets.LambdaFunction(cognitoExportFunction)],
    });

    new CfnOutput(this, 'CognitoExportFunctionName', {
      value: cognitoExportFunction.functionName,
      description: 'Invoke this Lambda to run an on-demand Cognito user export',
    });

    // IAM: Allow Lambda to upload/delete objects in the media bucket
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:DeleteObject'],
        resources: [`${props.mediaBucketArn}/*`],
      }),
    );

    // IAM: Allow Lambda to invalidate deleted media at the CDN edge
    // (lib/cloudfront.ts) — scoped to just this one distribution, not '*'
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: [props.mediaDistributionArn],
      }),
    );

    // IAM: Allow Lambda to send emails via SES
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'], // SES doesn't support resource-level permissions well
      }),
    );

    // IAM: Allow Lambda to read the DB secret from Secrets Manager
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbSecret.secretArn],
      }),
    );

    // Look up the hosted zone for the domain
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    // ACM certificate for the API subdomain
    const apiCertificate = new acm.Certificate(this, 'ApiCertificate', {
      domainName: `api.${props.domainName}`,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // Custom domain for API Gateway
    const customDomain = new apigatewayv2.DomainName(this, 'ApiDomainName', {
      domainName: `api.${props.domainName}`,
      certificate: apiCertificate,
    });

    // API Gateway HTTP API with Lambda proxy integration
    const httpApi = new apigatewayv2.HttpApi(this, 'BromnBlogHttpApi', {
      apiName: 'broomns-blog-api',
      description: "Broomn's Blog REST API",
      corsPreflight: {
        // API Gateway answers the browser's CORS preflight itself, before it
        // ever reaches the Lambda — so this list (not Fastify's own @fastify/cors
        // config in app.ts, which only governs local dev hitting the Fastify
        // server directly) is what actually gates which headers a browser can
        // send in production. X-Session-Id was added to the frontend api
        // client without updating this list, which silently broke every
        // client-side fetch in prod (2026-07-25 incident: the homepage's
        // post list — and everything else fetched client-side — appeared
        // empty because the browser blocked the request after a failed
        // preflight, even though the API and database were completely fine).
        allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['https://blogdobroomn.com'],
        maxAge: Duration.hours(1),
      },
      defaultDomainMapping: {
        domainName: customDomain,
      },
    });

    // Proxy integration: all routes → Lambda
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'LambdaIntegration',
        apiFunction,
      ),
    });

    // Also handle root path
    httpApi.addRoutes({
      path: '/',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'LambdaRootIntegration',
        apiFunction,
      ),
    });

    // Route53 A record pointing to API Gateway custom domain
    new route53.ARecord(this, 'ApiARecord', {
      zone: hostedZone,
      recordName: 'api',
      target: route53.RecordTarget.fromAlias(
        new route53Targets.ApiGatewayv2DomainProperties(
          customDomain.regionalDomainName,
          customDomain.regionalHostedZoneId,
        ),
      ),
    });

    // Store reference for cross-stack usage
    this.apiUrl = `https://api.${props.domainName}`;

    // CloudFormation Outputs
    new CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'API Gateway custom domain URL',
    });

    new CfnOutput(this, 'HttpApiId', {
      value: httpApi.httpApiId,
      description: 'HTTP API ID',
    });

    new CfnOutput(this, 'LambdaFunctionArn', {
      value: apiFunction.functionArn,
      description: 'API Lambda function ARN',
    });
  }
}
