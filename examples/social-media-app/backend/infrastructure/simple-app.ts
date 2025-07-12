import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class SimpleSocialMediaApp extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const stage = this.node.tryGetContext("stage") || "dev";

        // DynamoDB Table for all data
        const table = new dynamodb.Table(this, "SocialMediaTable", {
            tableName: `social-media-${stage}`,
            partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
        });

        // Add Global Secondary Indexes
        table.addGlobalSecondaryIndex({
            indexName: "GSI1",
            partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING }
        });

        table.addGlobalSecondaryIndex({
            indexName: "GSI2",
            partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING }
        });

        // Cognito User Pool
        const userPool = new cognito.UserPool(this, "SocialMediaUserPool", {
            userPoolName: `social-media-users-${stage}`,
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true
            },
            standardAttributes: {
                email: { required: true, mutable: true },
                givenName: { required: true, mutable: true },
                familyName: { required: true, mutable: true }
            },
            customAttributes: {
                username: new cognito.StringAttribute({ minLen: 3, maxLen: 20, mutable: true }),
                bio: new cognito.StringAttribute({ minLen: 0, maxLen: 500, mutable: true })
            }
        });

        const userPoolClient = new cognito.UserPoolClient(this, "SocialMediaUserPoolClient", {
            userPool,
            generateSecret: false,
            authFlows: {
                userPassword: true,
                userSrp: true
            }
        });

        // S3 Bucket for frontend hosting
        const frontendBucket = new s3.Bucket(this, "SocialMediaFrontend", {
            bucketName: `social-media-frontend-${stage}-${this.account}`,
            websiteIndexDocument: "index.html",
            websiteErrorDocument: "index.html",
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
            publicReadAccess: true,
            removalPolicy: stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ]
        });

        // S3 Bucket for file uploads
        const filesBucket = new s3.Bucket(this, "SocialMediaFiles", {
            bucketName: `social-media-files-${stage}-${this.account}`,
            versioned: stage === "prod",
            encryption: s3.BucketEncryption.S3_MANAGED,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
                    allowedOrigins: ["*"],
                    allowedHeaders: ["*"]
                }
            ],
            lifecycleRules: [
                {
                    id: "DeleteIncompleteMultipartUploads",
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7)
                }
            ],
            removalPolicy: stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
        });

        // Lambda execution role
        const lambdaRole = new iam.Role(this, "SocialMediaLambdaRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Grant permissions
        table.grantReadWriteData(lambdaRole);
        filesBucket.grantReadWrite(lambdaRole);

        // Environment variables for Lambda functions
        const commonEnvironment = {
            STAGE: stage,
            DYNAMODB_TABLE_NAME: table.tableName,
            USER_POOL_ID: userPool.userPoolId,
            USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
            S3_BUCKET_NAME: filesBucket.bucketName
        };

        // Simple Lambda function for all operations
        const apiFunction = new lambda.Function(this, "SocialMediaApiFunction", {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "index.handler",
            code: lambda.Code.fromInline(`
                exports.handler = async (event) => {
                    console.log('Event:', JSON.stringify(event, null, 2));
                    
                    const response = {
                        statusCode: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                        },
                        body: JSON.stringify({
                            message: 'Social Media API is working!',
                            path: event.path,
                            method: event.httpMethod,
                            stage: '${stage}'
                        })
                    };
                    
                    return response;
                };
            `),
            environment: commonEnvironment,
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30)
        });

        // API Gateway
        const api = new apigateway.RestApi(this, "SocialMediaApi", {
            restApiName: `social-media-api-${stage}`,
            description: "Social Media Application API",
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
            }
        });

        // Cognito Authorizer
        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "SocialMediaAuthorizer", {
            cognitoUserPools: [userPool]
        });

        // Lambda integration
        const lambdaIntegration = new apigateway.LambdaIntegration(apiFunction);

        // API Routes
        const postsResource = api.root.addResource("posts");
        postsResource.addMethod("GET", lambdaIntegration, { authorizer });
        postsResource.addMethod("POST", lambdaIntegration, { authorizer });

        const postResource = postsResource.addResource("{id}");
        postResource.addMethod("GET", lambdaIntegration, { authorizer });
        postResource.addMethod("PUT", lambdaIntegration, { authorizer });
        postResource.addMethod("DELETE", lambdaIntegration, { authorizer });

        // Comments routes - using the same {id} parameter
        const commentsResource = postResource.addResource("comments");
        commentsResource.addMethod("GET", lambdaIntegration, { authorizer });
        commentsResource.addMethod("POST", lambdaIntegration, { authorizer });

        // Upload route
        const uploadResource = api.root.addResource("upload");
        uploadResource.addMethod("POST", lambdaIntegration, { authorizer });

        // Health check (no auth required)
        const healthResource = api.root.addResource("health");
        healthResource.addMethod("GET", lambdaIntegration);

        // Outputs
        new cdk.CfnOutput(this, "ApiEndpoint", {
            value: api.url,
            description: "REST API endpoint"
        });

        new cdk.CfnOutput(this, "UserPoolId", {
            value: userPool.userPoolId,
            description: "Cognito User Pool ID"
        });

        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: userPoolClient.userPoolClientId,
            description: "Cognito User Pool Client ID"
        });

        new cdk.CfnOutput(this, "S3BucketName", {
            value: filesBucket.bucketName,
            description: "S3 bucket for file uploads"
        });

        new cdk.CfnOutput(this, "FrontendBucketName", {
            value: frontendBucket.bucketName,
            description: "S3 bucket for frontend hosting"
        });

        new cdk.CfnOutput(this, "FrontendUrl", {
            value: frontendBucket.bucketWebsiteUrl,
            description: "Frontend website URL"
        });

        new cdk.CfnOutput(this, "DynamoDBTableName", {
            value: table.tableName,
            description: "DynamoDB table name"
        });
    }
}

// CDK App
const app = new cdk.App();

new SimpleSocialMediaApp(app, "SocialMediaApp", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || "us-east-1"
    }
});

app.synth();
