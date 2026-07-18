import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Storage Stack - S3 bucket for media uploads (blog post images).
 *
 * Configured with CORS for the blog domain, public read access for serving
 * images directly, and a lifecycle rule to clean up incomplete multipart uploads.
 */
export class StorageStack extends Stack {
  /** The media bucket name */
  public readonly bucketName: string;
  /** The media bucket ARN */
  public readonly bucketArn: string;
  /** The S3 bucket construct */
  public readonly mediaBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 bucket for blog media uploads (post images, covers, etc.)
    const mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `broomns-blog-media-${this.account}`,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: [
            'https://blogdobroomn.com',
            'http://localhost:3000', // Local development
          ],
          exposedHeaders: ['ETag'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          // Clean up incomplete multipart uploads after 1 day
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
    });

    // Allow public read access for serving images
    mediaBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${mediaBucket.bucketArn}/*`],
        principals: [new iam.AnyPrincipal()],
      }),
    );

    // Store references for cross-stack usage
    this.bucketName = mediaBucket.bucketName;
    this.bucketArn = mediaBucket.bucketArn;
    this.mediaBucket = mediaBucket;

    // CloudFormation Outputs
    new CfnOutput(this, 'BucketName', {
      value: mediaBucket.bucketName,
      description: 'Media uploads S3 bucket name',
    });

    new CfnOutput(this, 'BucketArn', {
      value: mediaBucket.bucketArn,
      description: 'Media uploads S3 bucket ARN',
    });

    new CfnOutput(this, 'BucketDomainName', {
      value: mediaBucket.bucketRegionalDomainName,
      description: 'S3 bucket regional domain name for serving media',
    });
  }
}
