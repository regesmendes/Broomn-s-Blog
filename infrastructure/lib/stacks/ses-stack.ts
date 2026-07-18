import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SesStackProps extends StackProps {
  /** Root domain name (blogdobroomn.com) */
  domainName: string;
}

/**
 * SES Stack - Email sending configuration for newsletter and notifications.
 *
 * The blogdobroomn.com domain is already verified in SES.
 * This stack just outputs the configuration values needed by the API.
 */
export class SesStack extends Stack {
  constructor(scope: Construct, id: string, props: SesStackProps) {
    super(scope, id, props);

    // The domain identity already exists in SES — we just reference it.
    // If you need to create it fresh, uncomment the EmailIdentity below.

    // CloudFormation Outputs
    new CfnOutput(this, 'SesIdentityDomain', {
      value: props.domainName,
      description: 'SES verified domain',
    });

    new CfnOutput(this, 'SenderEmail', {
      value: `noreply@${props.domainName}`,
      description: 'Verified sender email address for newsletters',
    });
  }
}
