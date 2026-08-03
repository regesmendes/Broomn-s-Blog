import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/stacks/storage-stack';
import { MediaCdnStack } from '../lib/stacks/media-cdn-stack';

function synthMediaCdnStackTemplate(): Template {
  const app = new cdk.App();

  const storageStack = new StorageStack(app, 'TestStorage');

  const mediaCdnStack = new MediaCdnStack(app, 'TestMediaCdn', {
    mediaBucket: storageStack.mediaBucket,
    hostedZoneId: 'TEST_HOSTED_ZONE_ID',
    domainName: 'example.com',
    budgetAlertEmail: 'test@example.com',
    budgetMonthlyLimitUsd: 20,
  });

  return Template.fromStack(mediaCdnStack);
}

describe('MediaCdnStack', () => {
  it('creates exactly one CloudFront distribution on the media subdomain', () => {
    const template = synthMediaCdnStackTemplate();

    const distributions = template.findResources('AWS::CloudFront::Distribution');
    const keys = Object.keys(distributions);
    expect(keys).toHaveLength(1);

    const config = distributions[keys[0]].Properties.DistributionConfig;
    expect(config.Aliases).toEqual(['media.example.com']);
  });

  it('does not forward or vary the cache key on the Origin header', () => {
    const template = synthMediaCdnStackTemplate();

    const distributions = template.findResources('AWS::CloudFront::Distribution');
    const config = Object.values(distributions)[0] as { Properties: { DistributionConfig: Record<string, unknown> } };
    const defaultBehavior = config.Properties.DistributionConfig.DefaultCacheBehavior as Record<string, unknown>;

    // No OriginRequestPolicyId at all — CACHING_OPTIMIZED alone, matching
    // the "no Origin-varying policy" decision (see media-cdn-stack.ts).
    expect(defaultBehavior.OriginRequestPolicyId).toBeUndefined();
    expect(defaultBehavior.CachePolicyId).toBeDefined();
  });

  it('attaches a static (non-Origin-varying) CORS response headers policy', () => {
    const template = synthMediaCdnStackTemplate();

    const policies = template.findResources('AWS::CloudFront::ResponseHeadersPolicy');
    const keys = Object.keys(policies);
    expect(keys).toHaveLength(1);

    const config = policies[keys[0]].Properties.ResponseHeadersPolicyConfig;
    expect(config.CorsConfig.AccessControlAllowOrigins.Items).toEqual(['*']);
    expect(config.SecurityHeadersConfig.ContentTypeOptions.Override).toBe(true);
  });

  it('creates an ACM certificate for the media subdomain', () => {
    const template = synthMediaCdnStackTemplate();

    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'media.example.com',
    });
  });

  it('creates a monthly CloudFront+S3 cost budget with 80%/100% actual and 100% forecasted alerts', () => {
    const template = synthMediaCdnStackTemplate();

    const budgetResources = template.findResources('AWS::Budgets::Budget');
    const keys = Object.keys(budgetResources);
    expect(keys).toHaveLength(1);

    const config = budgetResources[keys[0]].Properties.Budget;
    expect(config.BudgetType).toBe('COST');
    expect(config.TimeUnit).toBe('MONTHLY');
    expect(config.BudgetLimit).toEqual({ Amount: 20, Unit: 'USD' });
    expect(config.CostFilters.Service).toEqual(
      expect.arrayContaining(['Amazon CloudFront', 'Amazon Simple Storage Service']),
    );

    const notifications = budgetResources[keys[0]].Properties.NotificationsWithSubscribers;
    expect(notifications).toHaveLength(3);
    const shapes = notifications.map((n: { Notification: { NotificationType: string; Threshold: number } }) => ({
      type: n.Notification.NotificationType,
      threshold: n.Notification.Threshold,
    }));
    expect(shapes).toEqual(
      expect.arrayContaining([
        { type: 'ACTUAL', threshold: 80 },
        { type: 'ACTUAL', threshold: 100 },
        { type: 'FORECASTED', threshold: 100 },
      ]),
    );
  });

  it('subscribes the configured alert email to the budget SNS topic', () => {
    const template = synthMediaCdnStackTemplate();

    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'test@example.com',
    });
  });

  it('attaches a CLOUDFRONT-scoped WAF WebACL with a per-IP rate limit to the distribution', () => {
    const template = synthMediaCdnStackTemplate();

    const webAcls = template.findResources('AWS::WAFv2::WebACL');
    const keys = Object.keys(webAcls);
    expect(keys).toHaveLength(1);

    const webAcl = webAcls[keys[0]];
    expect(webAcl.Properties.Scope).toBe('CLOUDFRONT');

    const rule = webAcl.Properties.Rules[0];
    expect(rule.Statement.RateBasedStatement.AggregateKeyType).toBe('IP');
    expect(rule.Statement.RateBasedStatement.Limit).toBeGreaterThanOrEqual(100);
    expect(rule.Action).toEqual({ Block: {} });

    const distributions = template.findResources('AWS::CloudFront::Distribution');
    const distConfig = Object.values(distributions)[0] as { Properties: { DistributionConfig: Record<string, unknown> } };
    expect(distConfig.Properties.DistributionConfig.WebACLId).toBeDefined();
  });

  it('grants budgets.amazonaws.com permission to publish to the alert topic', () => {
    const template = synthMediaCdnStackTemplate();

    const policies = template.findResources('AWS::SNS::TopicPolicy');
    const keys = Object.keys(policies);
    expect(keys).toHaveLength(1);

    const statement = policies[keys[0]].Properties.PolicyDocument.Statement[0];
    expect(statement.Principal.Service).toBe('budgets.amazonaws.com');
    expect(statement.Action).toBe('sns:Publish');
  });
});
