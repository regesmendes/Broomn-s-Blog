import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { MediaCdnStack } from '../lib/stacks/media-cdn-stack';
import { ApiStack } from '../lib/stacks/api-stack';

// Every custom header the frontend ever sends to the API (see
// frontend/src/lib/api.ts and usePageViewTracking.ts). API Gateway answers the
// browser's CORS preflight itself, before a request ever reaches the Lambda,
// so this list has to independently match whatever headers the frontend
// actually sends — Fastify's own @fastify/cors config in app.ts only governs
// local dev, which hits the Fastify server directly and can't catch a drift
// here. This exact gap silently broke every client-side fetch in production
// on 2026-07-25 when X-Session-Id was added to the frontend client without
// updating this stack's CORS config.
const EXPECTED_CORS_HEADERS = ['Content-Type', 'Authorization', 'X-Session-Id'];

function synthApiStackTemplate(): Template {
  const app = new cdk.App();

  const databaseStack = new DatabaseStack(app, 'TestDatabase');
  const cognitoStack = new CognitoStack(app, 'TestCognito', {
    googleClientId: 'test-client-id',
    googleClientSecret: 'test-client-secret',
  });
  const storageStack = new StorageStack(app, 'TestStorage');
  const mediaCdnStack = new MediaCdnStack(app, 'TestMediaCdn', {
    mediaBucket: storageStack.mediaBucket,
    hostedZoneId: 'TEST_HOSTED_ZONE_ID',
    domainName: 'example.com',
    budgetAlertEmail: 'test@example.com',
    budgetMonthlyLimitUsd: 20,
  });

  const apiStack = new ApiStack(app, 'TestApi', {
    vpc: databaseStack.vpc,
    lambdaSecurityGroup: databaseStack.lambdaSecurityGroup,
    dbInstance: databaseStack.dbInstance,
    userPoolId: cognitoStack.userPoolId,
    userPoolArn: cognitoStack.userPoolArn,
    userPoolClientId: cognitoStack.userPoolClientId,
    cognitoDomain: cognitoStack.cognitoDomain,
    mediaBucketName: storageStack.bucketName,
    mediaBucketArn: storageStack.bucketArn,
    backupBucketName: storageStack.backupBucketName,
    backupBucketArn: storageStack.backupBucketArn,
    mediaCdnDomain: mediaCdnStack.domainNameOutput,
    mediaDistributionId: mediaCdnStack.distributionId,
    mediaDistributionArn: mediaCdnStack.distributionArn,
    hostedZoneId: 'TEST_HOSTED_ZONE_ID',
    domainName: 'example.com',
  });
  apiStack.addDependency(mediaCdnStack);

  return Template.fromStack(apiStack);
}

describe('ApiStack CORS configuration', () => {
  it("allows exactly the headers the frontend's API client actually sends", () => {
    const template = synthApiStackTemplate();

    const apis = template.findResources('AWS::ApiGatewayV2::Api');
    const apiKeys = Object.keys(apis);
    expect(apiKeys).toHaveLength(1);

    const corsConfig = apis[apiKeys[0]].Properties.CorsConfiguration;
    expect(corsConfig).toBeDefined();
    expect([...corsConfig.AllowHeaders].sort()).toEqual([...EXPECTED_CORS_HEADERS].sort());
  });
});

describe('ApiStack media CDN wiring', () => {
  it('grants cloudfront:CreateInvalidation scoped to the media distribution only, not *', () => {
    const template = synthApiStackTemplate();

    const policies = template.findResources('AWS::IAM::Policy');
    const invalidationStatements = Object.values(policies).flatMap((policy) => {
      const doc = (policy as { Properties: { PolicyDocument: { Statement: Array<Record<string, unknown>> } } })
        .Properties.PolicyDocument.Statement;
      return doc.filter((statement) => {
        const actions = ([] as string[]).concat(statement.Action as string | string[]);
        return actions.includes('cloudfront:CreateInvalidation');
      });
    });

    expect(invalidationStatements).toHaveLength(1);
    expect(invalidationStatements[0].Resource).not.toBe('*');
  });
});
