import * as cdk from "aws-cdk-lib";
import {
  ApiGatewayStack,
  AuthStack,
  DatabaseStack,
  FileStack,
  MonitoringStack,
  NetworkingStack,
  ServerlessStack,
  WebSocketApiStack,
  WebStack
} from "aws-framework";
import { Construct } from "constructs";

export class SocialMediaApp extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const stage = this.node.tryGetContext("stage") || "dev";
        const domainName = this.node.tryGetContext("domainName");
        const certificateArn = this.node.tryGetContext("certificateArn");

        // Networking Stack - VPC with public/private subnets
        const networkingStack = new NetworkingStack(this, "SocialMediaNetworking", {
            cidr: "10.0.0.0/16",
            maxAzs: 2,
            enableNatGateway: stage === "prod"
        });

        // Database Stack - DynamoDB tables
        const databaseStack = new DatabaseStack(this, "SocialMediaDatabase", {
            tableName: `social-media-${stage}`,
            enablePointInTimeRecovery: stage === "prod",
            enableBackup: stage === "prod",
            globalSecondaryIndexes: [
                {
                    indexName: "GSI1",
                    partitionKey: { name: "GSI1PK", type: cdk.aws_dynamodb.AttributeType.STRING },
                    sortKey: { name: "GSI1SK", type: cdk.aws_dynamodb.AttributeType.STRING }
                },
                {
                    indexName: "GSI2",
                    partitionKey: { name: "GSI2PK", type: cdk.aws_dynamodb.AttributeType.STRING },
                    sortKey: { name: "GSI2SK", type: cdk.aws_dynamodb.AttributeType.STRING }
                }
            ]
        });

        // WebSocket connections table
        const connectionsTable = new cdk.aws_dynamodb.Table(this, "ConnectionsTable", {
            tableName: `social-media-connections-${stage}`,
            partitionKey: { name: "PK", type: cdk.aws_dynamodb.AttributeType.STRING },
            sortKey: { name: "SK", type: cdk.aws_dynamodb.AttributeType.STRING },
            billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: stage === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
            globalSecondaryIndexes: [
                {
                    indexName: "GSI1",
                    partitionKey: { name: "GSI1PK", type: cdk.aws_dynamodb.AttributeType.STRING },
                    sortKey: { name: "GSI1SK", type: cdk.aws_dynamodb.AttributeType.STRING }
                }
            ]
        });

        // Authentication Stack - Cognito User Pool
        const authStack = new AuthStack(this, "SocialMediaAuth", {
            userPoolName: `social-media-users-${stage}`,
            enableSelfSignUp: true,
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
                username: new cdk.aws_cognito.StringAttribute({ minLen: 3, maxLen: 20, mutable: true }),
                bio: new cdk.aws_cognito.StringAttribute({ minLen: 0, maxLen: 500, mutable: true })
            }
        });

        // File Storage Stack - S3 buckets for media
        const fileStack = new FileStack(this, "SocialMediaFiles", {
            bucketName: `social-media-files-${stage}`,
            enableVersioning: stage === "prod",
            enableEncryption: true,
            lifecycleRules: [
                {
                    id: "DeleteIncompleteMultipartUploads",
                    abortIncompleteMultipartUploadAfter: cdk.Duration.days(7)
                },
                {
                    id: "TransitionToIA",
                    transitions: [
                        {
                            storageClass: cdk.aws_s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(30)
                        }
                    ]
                }
            ]
        });

        // Serverless Stack - Lambda functions
        const serverlessStack = new ServerlessStack(this, "SocialMediaServerless", {
            vpc: networkingStack.vpc
        });

        // Environment variables for all Lambda functions
        const commonEnvironment = {
            STAGE: stage,
            DYNAMODB_TABLE_NAME: databaseStack.table.tableName,
            CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
            USER_POOL_ID: authStack.userPool.userPoolId,
            USER_POOL_CLIENT_ID: authStack.userPoolClient.userPoolClientId,
            S3_BUCKET_NAME: fileStack.bucket.bucketName,
            AWS_REGION: this.region
        };

        // Create Lambda functions
        const postsFunction = serverlessStack.createNodejsFunction(
            "PostsFunction",
            "./src/handlers/posts",
            "handler",
            {
                environment: commonEnvironment,
                timeout: cdk.Duration.seconds(30)
            }
        );

        const commentsFunction = serverlessStack.createNodejsFunction(
            "CommentsFunction",
            "./src/handlers/comments",
            "handler",
            {
                environment: commonEnvironment,
                timeout: cdk.Duration.seconds(30)
            }
        );

        const chatFunction = serverlessStack.createNodejsFunction(
            "ChatFunction",
            "./src/handlers/chat",
            "handler",
            {
                environment: commonEnvironment,
                timeout: cdk.Duration.seconds(30)
            }
        );

        const fileUploadFunction = serverlessStack.createNodejsFunction(
            "FileUploadFunction",
            "./src/handlers/file-upload",
            "handler",
            {
                environment: commonEnvironment,
                timeout: cdk.Duration.seconds(30)
            }
        );

        // WebSocket Lambda function
        const websocketFunction = serverlessStack.createNodejsFunction(
            "WebSocketFunction",
            "./src/handlers/websocket",
            "handler",
            {
                environment: {
                    ...commonEnvironment,
                    WEBSOCKET_API_ENDPOINT: "" // Will be set after WebSocket API creation
                },
                timeout: cdk.Duration.seconds(30)
            }
        );

        // Grant permissions to Lambda functions
        databaseStack.table.grantReadWriteData(postsFunction);
        databaseStack.table.grantReadWriteData(commentsFunction);
        databaseStack.table.grantReadWriteData(chatFunction);
        databaseStack.table.grantReadWriteData(websocketFunction);

        connectionsTable.grantReadWriteData(websocketFunction);

        fileStack.bucket.grantReadWrite(fileUploadFunction);
        fileStack.bucket.grantRead(postsFunction);

        // REST API Gateway Stack
        const apiStack = new ApiGatewayStack(this, "SocialMediaApi", {
            apiName: `social-media-api-${stage}`,
            cors: {
                allowOrigins: stage === "prod" ? [domainName] : ["*"],
                allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allowHeaders: ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
            },
            defaultAuthorizer: {
                type: "COGNITO_USER_POOLS",
                authorizerName: "CognitoAuthorizer",
                userPools: [authStack.userPool]
            }
        });

        // Add API routes
        // Posts endpoints
        apiStack.addLambdaIntegration("/posts", "GET", postsFunction);
        apiStack.addLambdaIntegration("/posts", "POST", postsFunction);
        apiStack.addLambdaIntegration("/posts/{id}", "GET", postsFunction);
        apiStack.addLambdaIntegration("/posts/{id}", "PUT", postsFunction);
        apiStack.addLambdaIntegration("/posts/{id}", "DELETE", postsFunction);

        // Comments endpoints
        apiStack.addLambdaIntegration("/posts/{postId}/comments", "GET", commentsFunction);
        apiStack.addLambdaIntegration("/posts/{postId}/comments", "POST", commentsFunction);
        apiStack.addLambdaIntegration("/comments/{id}", "PUT", commentsFunction);
        apiStack.addLambdaIntegration("/comments/{id}", "DELETE", commentsFunction);

        // Chat endpoints
        apiStack.addLambdaIntegration("/chats", "GET", chatFunction);
        apiStack.addLambdaIntegration("/chats", "POST", chatFunction);
        apiStack.addLambdaIntegration("/chats/{id}", "GET", chatFunction);
        apiStack.addLambdaIntegration("/chats/{id}", "PUT", chatFunction);
        apiStack.addLambdaIntegration("/chats/{id}", "DELETE", chatFunction);
        apiStack.addLambdaIntegration("/chats/{chatId}/messages", "GET", chatFunction);
        apiStack.addLambdaIntegration("/chats/{chatId}/messages", "POST", chatFunction);
        apiStack.addLambdaIntegration("/messages/{id}", "PUT", chatFunction);
        apiStack.addLambdaIntegration("/messages/{id}", "DELETE", chatFunction);

        // File upload endpoints
        apiStack.addLambdaIntegration("/upload", "POST", fileUploadFunction);

        // WebSocket API Stack
        const websocketStack = new WebSocketApiStack(this, "SocialMediaWebSocket", {
            apiName: `social-media-websocket-${stage}`,
            stageName: stage,
            enableLogging: stage === "prod"
        });

        // Set up WebSocket routes
        websocketStack.setupDefaultRoutes(websocketFunction);

        // Grant WebSocket permissions
        websocketStack.grantManageConnections(websocketFunction);

        // Web Stack - CloudFront distribution (if domain provided)
        if (domainName && certificateArn) {
            const webStack = new WebStack(this, "SocialMediaWeb", {
                domainName,
                certificateArn,
                originBucket: fileStack.bucket,
                apiGatewayDomainName: apiStack.api.domainName?.domainName,
                enableLogging: stage === "prod"
            });
        }

        // Monitoring Stack
        const monitoringStack = new MonitoringStack(this, "SocialMediaMonitoring", {
            dashboardName: `SocialMedia-${stage}`,
            lambdaFunctions: [
                postsFunction,
                commentsFunction,
                chatFunction,
                fileUploadFunction,
                websocketFunction
            ],
            dynamoTables: [databaseStack.table, connectionsTable],
            apiGateway: apiStack.api,
            enableAlarms: stage === "prod"
        });

        // Outputs
        new cdk.CfnOutput(this, "ApiEndpoint", {
            value: apiStack.api.url,
            description: "REST API endpoint"
        });

        new cdk.CfnOutput(this, "WebSocketEndpoint", {
            value: websocketStack.stage.url,
            description: "WebSocket API endpoint"
        });

        new cdk.CfnOutput(this, "UserPoolId", {
            value: authStack.userPool.userPoolId,
            description: "Cognito User Pool ID"
        });

        new cdk.CfnOutput(this, "UserPoolClientId", {
            value: authStack.userPoolClient.userPoolClientId,
            description: "Cognito User Pool Client ID"
        });

        new cdk.CfnOutput(this, "S3BucketName", {
            value: fileStack.bucket.bucketName,
            description: "S3 bucket for file uploads"
        });

        if (domainName) {
            new cdk.CfnOutput(this, "WebsiteUrl", {
                value: `https://${domainName}`,
                description: "Website URL"
            });
        }
    }
}

// CDK App
const app = new cdk.App();

new SocialMediaApp(app, "SocialMediaApp", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    }
});

app.synth();
