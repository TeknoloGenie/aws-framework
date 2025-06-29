import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface S3BucketProps {
  bucketName?: string;
  versioned?: boolean;
  publicReadAccess?: boolean;
  cors?: boolean;
  lifecycleRules?: s3.LifecycleRule[];
  encryption?: s3.BucketEncryption;
}

export class StorageStack extends cdk.Stack {
    public readonly buckets: Record<string, s3.Bucket> = {};

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    }

    public addS3Bucket(id: string, props: S3BucketProps = {}): s3.Bucket {
        const bucket = new s3.Bucket(this, id, {
            bucketName: props.bucketName,
            versioned: props.versioned || false,
            publicReadAccess: props.publicReadAccess || false,
            blockPublicAccess: props.publicReadAccess
                ? s3.BlockPublicAccess.BLOCK_ACLS
                : s3.BlockPublicAccess.BLOCK_ALL,
            encryption: props.encryption || s3.BucketEncryption.S3_MANAGED,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
            cors: props.cors ? [
                {
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.POST,
                        s3.HttpMethods.PUT,
                        s3.HttpMethods.DELETE,
                        s3.HttpMethods.HEAD,
                    ],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"],
                    maxAge: 3000,
                },
            ] : undefined,
            lifecycleRules: props.lifecycleRules,
        });

        // Store the bucket reference
        this.buckets[id] = bucket;

        // Export the bucket name and ARN
        new cdk.CfnOutput(this, `${id}BucketName`, {
            value: bucket.bucketName,
            exportName: `${this.stackName}-${id}-BucketName`,
        });

        new cdk.CfnOutput(this, `${id}BucketArn`, {
            value: bucket.bucketArn,
            exportName: `${this.stackName}-${id}-BucketArn`,
        });

        return bucket;
    }

    public grantReadAccess(bucket: s3.Bucket, grantee: iam.IGrantable): iam.Grant {
        return bucket.grantRead(grantee);
    }

    public grantWriteAccess(bucket: s3.Bucket, grantee: iam.IGrantable): iam.Grant {
        return bucket.grantWrite(grantee);
    }

    public grantReadWriteAccess(bucket: s3.Bucket, grantee: iam.IGrantable): iam.Grant {
        return bucket.grantReadWrite(grantee);
    }
}
