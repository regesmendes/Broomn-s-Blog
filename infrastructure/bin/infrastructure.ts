#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/stacks/cognito-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';
import { SesStack } from '../lib/stacks/ses-stack';

// blogdobroomn is sunset (see docs/disaster-recovery.md's "Resurrection
// runbook"). DatabaseStack, ApiStack, and MediaCdnStack were destroyed
// manually and removed from this app in the same change — their source
// still exists on disk (database-stack.ts, api-stack.ts, media-cdn-stack.ts)
// and in git history (see the runbook for the commit to restore from).
// What's left running: Cognito (idle, $0), the S3 buckets (media + backups,
// data preserved), SES (idle, $0), and the static sunset page.

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
// User authentication via Google OAuth. Left running (idle, no cost) so a
// future reactivation doesn't need to reconcile user IDs — see the
// "Scenario: Cognito User Pool lost or deleted" runbook in
// docs/disaster-recovery.md for why that scenario is worth avoiding.
new CognitoStack(app, 'BromnBlog-Cognito', {
  env,
  googleClientId,
  googleClientSecret,
  description: "Broomn's Blog - Cognito User Pool with Google OAuth",
});

// --- Storage Stack ---
// S3 buckets for media uploads and backups — data preserved for a future
// reactivation, not served over HTTP while sunset (MediaCdnStack is gone).
new StorageStack(app, 'BromnBlog-Storage', {
  env,
  description: "Broomn's Blog - S3 media storage",
});

// --- SES Stack ---
// Email sending config. Left running (idle, no cost) for reactivation.
new SesStack(app, 'BromnBlog-Ses', {
  env,
  domainName,
  hostedZoneId,
  description: "Broomn's Blog - SES email configuration",
});

// --- Frontend Stack ---
// Static sunset page: S3 + CloudFront (see frontend-stack.ts).
new FrontendStack(app, 'BromnBlog-Frontend', {
  env,
  hostedZoneId,
  domainName,
  description: "Broomn's Blog - Frontend (sunset page)",
});

app.synth();
