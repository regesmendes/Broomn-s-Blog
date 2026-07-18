import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as route53 from 'aws-cdk-lib/aws-route53';

export interface SesStackProps extends StackProps {
  /** Root domain name (blogdobroomn.com) */
  domainName: string;
  /** Route53 Hosted Zone ID for the domain */
  hostedZoneId: string;
}

/**
 * SES Stack - Email sending configuration for newsletter and notifications.
 *
 * Verifies the blogdobroomn.com domain identity in SES. Using
 * Identity.publicHostedZone means CDK writes the DKIM (and MAIL FROM) DNS
 * records into Route53 automatically — no manual DNS step needed. SES
 * verification itself is asynchronous (usually minutes, occasionally longer);
 * check status with:
 *   aws sesv2 get-email-identity --email-identity blogdobroomn.com
 *
 * Note: verifying the domain does not lift SES's sending sandbox — that's a
 * separate, manually-reviewed request (see infrastructure/README or run
 * `aws sesv2 put-account-details` to request production access).
 */
export class SesStack extends Stack {
  constructor(scope: Construct, id: string, props: SesStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.domainName,
    });

    const identity = new ses.EmailIdentity(this, 'Identity', {
      identity: ses.Identity.publicHostedZone(hostedZone),
    });

    // CloudFormation Outputs
    new CfnOutput(this, 'SesIdentityDomain', {
      value: props.domainName,
      description: 'SES verified domain',
    });

    new CfnOutput(this, 'SenderEmail', {
      value: `noreply@${props.domainName}`,
      description: 'Verified sender email address for newsletters',
    });

    new CfnOutput(this, 'EmailIdentityArn', {
      value: identity.emailIdentityArn,
      description: 'SES email identity ARN',
    });
  }
}
