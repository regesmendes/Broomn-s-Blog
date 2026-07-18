#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { SesStack } from '../lib/stacks/ses-stack';

const app = new cdk.App();

// Environment configuration
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

// Context values (set via cdk.json, --context, or environment)
const googleClientId = app.node.tryGetContext('googleClientId') ?? 'PLACEHOLDER_GOOGLE_CLIENT_ID';
const googleClientSecret = app.node.tryGetContext('googleClientSecret') ?? 'PLACEHOLDER_GOOGLE_CLIENT_SECRET';
const hostedZoneId = app.node.tryGetContext('hostedZoneId') ?? 'PLACEHOLDER_HOSTED_ZONE_ID';
const domainName = 'blogdobroomn.com';

// --- Cognito Stack ---
// User authentication via Google OAuth
const cognitoStack = new CognitoStack(app, 'BromnBlog-Cognito', {
  env,
  googleClientId,
  googleClientSecret,
  description: "Broomn's Blog - Cognito User Pool with Google OAuth",
});

// --- Database Stack ---
// Aurora Serverless v2 PostgreSQL cluster
const databaseStack = new DatabaseStack(app, 'BromnBlog-Database', {
  env,
  description: "Broomn's Blog - RDS PostgreSQL database",
});

// --- Storage Stack ---
// S3 bucket for media uploads
const storageStack = new StorageStack(app, 'BromnBlog-Storage', {
  env,
  description: "Broomn's Blog - S3 media storage",
});

// --- SES Stack ---
// Email sending for newsletters and notifications
const sesStack = new SesStack(app, 'BromnBlog-Ses', {
  env,
  domainName,
  description: "Broomn's Blog - SES email configuration",
});

// --- API Stack ---
// Lambda + API Gateway (depends on Database, Cognito, Storage)
const apiStack = new ApiStack(app, 'BromnBlog-Api', {
  env,
  vpc: databaseStack.vpc,
  lambdaSecurityGroup: databaseStack.lambdaSecurityGroup,
  dbInstance: databaseStack.dbInstance,
  userPoolId: cognitoStack.userPoolId,
  userPoolClientId: cognitoStack.userPoolClientId,
  cognitoDomain: cognitoStack.cognitoDomain,
  mediaBucketName: storageStack.bucketName,
  mediaBucketArn: storageStack.bucketArn,
  hostedZoneId,
  domainName,
  description: "Broomn's Blog - API (Lambda + API Gateway)",
});

// Explicit dependencies
apiStack.addDependency(databaseStack);
apiStack.addDependency(cognitoStack);
apiStack.addDependency(storageStack);

// --- Frontend Stack ---
// S3 + CloudFront for static site hosting
const frontendStack = new FrontendStack(app, 'BromnBlog-Frontend', {
  env,
  hostedZoneId,
  domainName,
  description: "Broomn's Blog - Frontend (S3 + CloudFront)",
});

app.synth();
