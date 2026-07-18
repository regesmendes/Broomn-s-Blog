import { Stack, StackProps, CfnOutput, SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export interface CognitoStackProps extends StackProps {
  /** Google OAuth Client ID */
  googleClientId: string;
  /** Google OAuth Client Secret */
  googleClientSecret: string;
}

/**
 * Cognito Stack - Manages user authentication via Google OAuth.
 *
 * Users sign in exclusively through Google Identity Provider.
 * Self-signup is disabled — only federated users via Google are allowed.
 */
export class CognitoStack extends Stack {
  /** The Cognito User Pool ID */
  public readonly userPoolId: string;
  /** The Cognito App Client ID */
  public readonly userPoolClientId: string;
  /** The Cognito hosted UI domain */
  public readonly cognitoDomain: string;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    // User Pool: email-based sign-in, no self-registration (users come via Google)
    const userPool = new cognito.UserPool(this, 'BromnBlogUserPool', {
      userPoolName: 'broomns-blog-users',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: Stack.of(this).stackName.includes('prod')
        ? undefined // RETAIN for production
        : undefined, // Default behavior
    });

    // Google Identity Provider
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      'GoogleProvider',
      {
        userPool,
        clientId: props.googleClientId,
        clientSecretValue: SecretValue.unsafePlainText(props.googleClientSecret),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          fullname: cognito.ProviderAttribute.GOOGLE_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      },
    );

    // Hosted UI Domain (prefix-based: broomns-blog.auth.<region>.amazoncognito.com)
    const domain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: 'broomns-blog',
      },
    });

    // App Client with OAuth flows for authorization_code and implicit grant
    const userPoolClient = userPool.addClient('BromnBlogAppClient', {
      userPoolClientName: 'broomns-blog-web',
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['https://blogdobroomn.com/pt/auth/callback'],
        logoutUrls: ['https://blogdobroomn.com'],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      generateSecret: false,
    });

    // Ensure the client is created after the Google provider
    userPoolClient.node.addDependency(googleProvider);

    // Store references for cross-stack usage
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;
    this.cognitoDomain = domain.domainName;

    // CloudFormation Outputs
    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
    });

    new CfnOutput(this, 'CognitoDomainOutput', {
      value: `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Hosted UI Domain URL',
    });
  }
}
