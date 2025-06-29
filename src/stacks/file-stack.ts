import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface FileStackProps extends cdk.StackProps {
  /**
   * The name of the file service
   */
  serviceName: string;

  /**
   * VPC for private file sharing (optional)
   */
  vpc?: ec2.IVpc;

  /**
   * Subnets for Lambda functions in VPC
   */
  subnets?: ec2.ISubnet[];

  /**
   * Security group for Lambda functions
   */
  securityGroup?: ec2.ISecurityGroup;

  /**
   * API Gateway for public file operations
   */
  apiGateway?: apigateway.RestApi;

  /**
   * JWT authentication configuration
   */
  jwtAuth?: {
    userPoolId: string;
    clientId: string;
  };

  /**
   * File storage configuration
   */
  storageConfig?: {
    maxFileSize?: number; // in bytes
    allowedFileTypes?: string[];
    enableVersioning?: boolean;
    lifecycleRules?: s3.LifecycleRule[];
  };

  /**
   * CORS configuration for file uploads
   */
  corsConfig?: {
    allowOrigins?: string[];
    allowMethods?: string[];
    allowHeaders?: string[];
  };
}

export class FileStack extends cdk.Stack {
  public readonly publicBucket: s3.Bucket;
  public readonly privateBucket: s3.Bucket;
  public readonly uploadFunction: lambda.Function;
  public readonly downloadFunction: lambda.Function;
  public readonly privateShareFunction: lambda.Function;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: FileStackProps) {
    super(scope, id, props);

    // Create S3 buckets
    this.publicBucket = new s3.Bucket(this, "PublicFilesBucket", {
      bucketName: `${props.serviceName.toLowerCase()}-public-files-${this.account}-${this.region}`,
      versioned: props.storageConfig?.enableVersioning ?? true,
      lifecycleRules: props.storageConfig?.lifecycleRules,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
          allowedOrigins: props.corsConfig?.allowOrigins ?? ["*"],
          allowedHeaders: props.corsConfig?.allowHeaders ?? ["*"],
          maxAge: 3000,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.privateBucket = new s3.Bucket(this, "PrivateFilesBucket", {
      bucketName: `${props.serviceName.toLowerCase()}-private-files-${this.account}-${this.region}`,
      versioned: props.storageConfig?.enableVersioning ?? true,
      lifecycleRules: props.storageConfig?.lifecycleRules,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Create Lambda execution role
    const lambdaRole = new iam.Role(this, "FileHandlerRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
        ...(props.vpc ? [iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole")] : []),
      ],
    });

    // Grant S3 permissions to Lambda role
    this.publicBucket.grantReadWrite(lambdaRole);
    this.privateBucket.grantReadWrite(lambdaRole);

    // Common Lambda function properties
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        PUBLIC_BUCKET_NAME: this.publicBucket.bucketName,
        PRIVATE_BUCKET_NAME: this.privateBucket.bucketName,
        MAX_FILE_SIZE: (props.storageConfig?.maxFileSize ?? 10 * 1024 * 1024).toString(),
        ALLOWED_FILE_TYPES: JSON.stringify(props.storageConfig?.allowedFileTypes ?? []),
        JWT_USER_POOL_ID: props.jwtAuth?.userPoolId ?? "",
        JWT_CLIENT_ID: props.jwtAuth?.clientId ?? "",
      },
      vpc: props.vpc,
      vpcSubnets: props.subnets ? { subnets: props.subnets } : undefined,
      securityGroups: props.securityGroup ? [props.securityGroup] : undefined,
    };

    // File Upload Lambda
    this.uploadFunction = new lambdaNodejs.NodejsFunction(this, "FileUploadFunction", {
      ...commonLambdaProps,
      functionName: `${props.serviceName}-file-upload`,
      entry: require.resolve("../handlers/file-upload"),
      handler: "handler",
    });

    // File Download Lambda (with JWT auth)
    this.downloadFunction = new lambdaNodejs.NodejsFunction(this, "FileDownloadFunction", {
      ...commonLambdaProps,
      functionName: `${props.serviceName}-file-download`,
      entry: require.resolve("../handlers/file-download"),
      handler: "handler",
    });

    // Private File Share Lambda (for inter-service communication)
    this.privateShareFunction = new lambdaNodejs.NodejsFunction(this, "PrivateShareFunction", {
      ...commonLambdaProps,
      functionName: `${props.serviceName}-private-share`,
      entry: require.resolve("../handlers/private-share"),
      handler: "handler",
    });

    // Create or use existing API Gateway
    this.api = props.apiGateway ?? new apigateway.RestApi(this, "FileApi", {
      restApiName: `${props.serviceName}-file-api`,
      description: "File management API",
      defaultCorsPreflightOptions: {
        allowOrigins: props.corsConfig?.allowOrigins ?? ["*"],
        allowMethods: props.corsConfig?.allowMethods ?? ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: props.corsConfig?.allowHeaders ?? ["Content-Type", "Authorization"],
      },
    });

    // API Gateway integrations
    const filesResource = this.api.root.addResource("files");
    
    // Upload endpoint: POST /files
    filesResource.addMethod("POST", new apigateway.LambdaIntegration(this.uploadFunction), {
      authorizationType: props.jwtAuth ? apigateway.AuthorizationType.COGNITO : apigateway.AuthorizationType.NONE,
    });

    // Download endpoint: GET /files/{fileId}
    const fileResource = filesResource.addResource("{fileId}");
    fileResource.addMethod("GET", new apigateway.LambdaIntegration(this.downloadFunction), {
      authorizationType: props.jwtAuth ? apigateway.AuthorizationType.COGNITO : apigateway.AuthorizationType.NONE,
    });

    // Private share endpoint (for internal services)
    const privateResource = this.api.root.addResource("private");
    const privateFilesResource = privateResource.addResource("files");
    const privateFileResource = privateFilesResource.addResource("{fileId}");
    privateFileResource.addMethod("GET", new apigateway.LambdaIntegration(this.privateShareFunction));

    // Outputs
    new cdk.CfnOutput(this, "FileApiUrl", {
      value: this.api.url,
      description: "File API URL",
    });

    new cdk.CfnOutput(this, "PublicBucketName", {
      value: this.publicBucket.bucketName,
      description: "Public Files Bucket Name",
    });

    new cdk.CfnOutput(this, "PrivateBucketName", {
      value: this.privateBucket.bucketName,
      description: "Private Files Bucket Name",
    });
  }

  /**
   * Grant access to private files for other services in the same VPC
   */
  public grantPrivateFileAccess(grantee: iam.IGrantable): iam.Grant {
    return this.privateBucket.grantRead(grantee);
  }

  /**
   * Get the private file share function for internal service integration
   */
  public getPrivateShareFunction(): lambda.Function {
    return this.privateShareFunction;
  }
}
