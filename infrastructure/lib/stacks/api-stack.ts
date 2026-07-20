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
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

export interface ApiStackProps extends StackProps {
  /** VPC for Lambda to access Aurora */
  vpc: ec2.IVpc;
  /** Security group for Lambda (allows DB access) */
  lambdaSecurityGroup: ec2.ISecurityGroup;
  /** Aurora cluster endpoint (host:port) */
  dbInstance: rds.DatabaseInstance;
  /** Cognito User Pool ID */
  userPoolId: string;
  /** Cognito App Client ID */
  userPoolClientId: string;
  /** Cognito Domain */
  cognitoDomain: string;
  /** S3 media bucket name */
  mediaBucketName: string;
  /** S3 media bucket ARN */
  mediaBucketArn: string;
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

    // Resolve the real DB credentials at deploy time via a CloudFormation
    // dynamic reference — never bake the password into the CDK app itself.
    const dbSecret = props.dbInstance.secret!;
    const dbUsername = dbSecret.secretValueFromJson('username').unsafeUnwrap();
    const dbPassword = dbSecret.secretValueFromJson('password').unsafeUnwrap();

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
        NODE_ENV: 'production',
        DATABASE_URL: `postgresql://${dbUsername}:${dbPassword}@${props.dbInstance.dbInstanceEndpointAddress}:${props.dbInstance.dbInstanceEndpointPort}/broomnsblog`,
        JWT_SECRET: jwtSecretValue,
        CORS_ORIGIN: `https://${props.domainName}`,
        COGNITO_USER_POOL_ID: props.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClientId,
        COGNITO_DOMAIN: props.cognitoDomain,
        S3_BUCKET_NAME: props.mediaBucketName,
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
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
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
        DATABASE_URL: `postgresql://${dbUsername}:${dbPassword}@${props.dbInstance.dbInstanceEndpointAddress}:${props.dbInstance.dbInstanceEndpointPort}/broomnsblog`,
      },
    });

    new CfnOutput(this, 'MigrateFunctionName', {
      value: migrateFunction.functionName,
      description: 'Invoke this Lambda to run prisma migrate deploy against the live DB',
    });

    // IAM: Allow Lambda to upload/delete objects in the media bucket
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:DeleteObject'],
        resources: [`${props.mediaBucketArn}/*`],
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
        allowHeaders: ['Content-Type', 'Authorization'],
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

    // ── WAF ──────────────────────────────────────────────────────────────────
    // Regional Web ACL in front of the API Gateway HTTP API. Added after real
    // vulnerability-scanner traffic was observed hitting the API directly —
    // exhaustive probing for .env, .git/config, AWS/SSH credentials, etc. The
    // app-level rate limiter (api/src/app.ts) throttles abuse per user/IP but
    // doesn't recognize known-malicious IPs or common attack signatures
    // before they even reach the Lambda. ~$9-10/month (Web ACL + 4 rules,
    // request volume negligible at this app's traffic).
    const webAcl = new wafv2.CfnWebACL(this, 'ApiWebAcl', {
      name: 'broomns-blog-api-waf',
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'broomns-blog-api-waf',
      },
      rules: [
        {
          name: 'AWS-AWSManagedRulesCommonRuleSet',
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRuleSet',
          },
        },
        {
          name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'KnownBadInputs',
          },
        },
        {
          name: 'AWS-AWSManagedRulesAmazonIpReputationList',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'IpReputationList',
          },
        },
        {
          // Blocks an IP once it crosses 300 requests in a rolling 5-minute
          // window — well above real usage (the app's own per-user rate
          // limit is 100/min already), but catches exactly the scanning
          // behavior observed in production (one IP hit 120+ distinct paths
          // within seconds).
          name: 'RateLimitPerIp',
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 300,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitPerIp',
          },
        },
      ],
    });

    // HTTP API stages can't be referenced as an IStage with a WAF-compatible
    // ARN via the L2 construct, so build the association ARN directly —
    // `new HttpApi(...)` above (no `createDefaultStage: false`) always
    // auto-creates the `$default` stage.
    new wafv2.CfnWebACLAssociation(this, 'ApiWebAclAssociation', {
      resourceArn: `arn:aws:apigateway:${this.region}::/apis/${httpApi.httpApiId}/stages/$default`,
      webAclArn: webAcl.attrArn,
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

    new CfnOutput(this, 'WebAclArn', {
      value: webAcl.attrArn,
      description: 'WAF Web ACL protecting the API Gateway',
    });
  }
}
