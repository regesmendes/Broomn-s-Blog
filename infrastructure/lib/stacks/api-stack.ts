import { Stack, StackProps, CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as rds from 'aws-cdk-lib/aws-rds';

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

    // Lambda function running the Fastify API
    const apiFunction = new lambda.Function(this, 'ApiFn', {
      functionName: 'broomns-blog-api',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../api/dist'), // Built API artifact
      memorySize: 512,
      timeout: Duration.seconds(30),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [props.lambdaSecurityGroup],
      environment: {
        NODE_ENV: 'production',
        DATABASE_URL: `postgresql://broomns_admin:PLACEHOLDER@${props.dbInstance.dbInstanceEndpointAddress}:${props.dbInstance.dbInstanceEndpointPort}/broomnsblog`,
        COGNITO_USER_POOL_ID: props.userPoolId,
        COGNITO_CLIENT_ID: props.userPoolClientId,
        COGNITO_DOMAIN: props.cognitoDomain,
        S3_BUCKET_NAME: props.mediaBucketName,
        AWS_REGION_NAME: 'us-east-1',
        FRONTEND_URL: 'https://blogdobroomn.com',
        SES_FROM_EMAIL: 'noreply@blogdobroomn.com',
      },
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
        resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:broomns-blog/db-credentials*`],
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
