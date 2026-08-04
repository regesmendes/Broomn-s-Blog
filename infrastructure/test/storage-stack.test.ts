import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/stacks/storage-stack';

function synthStorageStackTemplate(): Template {
  const app = new cdk.App();
  const storageStack = new StorageStack(app, 'TestStorage');
  return Template.fromStack(storageStack);
}

describe('StorageStack media bucket access (issue #87 Part B item 9 — OAC lockdown)', () => {
  it('blocks all public access on the media bucket', () => {
    const template = synthStorageStackTemplate();

    const buckets = template.findResources('AWS::S3::Bucket');
    const mediaBucketKey = Object.keys(buckets).find((k) => k.startsWith('MediaBucket'));
    expect(mediaBucketKey).toBeDefined();

    const config = buckets[mediaBucketKey!].Properties.PublicAccessBlockConfiguration;
    expect(config).toEqual({
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    });
  });

  it('grants read access to cloudfront.amazonaws.com only, scoped by distribution ARN — never AnyPrincipal', () => {
    const template = synthStorageStackTemplate();

    const policies = template.findResources('AWS::S3::BucketPolicy');
    const keys = Object.keys(policies);
    expect(keys).toHaveLength(1);

    const statements = policies[keys[0]].Properties.PolicyDocument.Statement as Array<Record<string, unknown>>;
    expect(statements).toHaveLength(1);

    const statement = statements[0];
    expect(statement.Principal).toEqual({ Service: 'cloudfront.amazonaws.com' });
    expect(statement.Action).toBe('s3:GetObject');
    expect(statement.Condition).toEqual({
      StringEquals: { 'AWS:SourceArn': expect.stringContaining('arn:aws:cloudfront::') },
    });

    // Never a wildcard/AnyPrincipal grant — that's the exact thing this
    // lockdown removed.
    const asJson = JSON.stringify(statements);
    expect(asJson).not.toContain('"AWS":"*"');
    expect(asJson.toLowerCase()).not.toContain('anyprincipal');
  });
});
