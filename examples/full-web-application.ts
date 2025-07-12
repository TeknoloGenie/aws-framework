#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import {
    NetworkingStack,
    ApiGatewayStack,
    DatabaseStack,
    AuthStack,
    WebStack,
    FileStack,
    ServerlessStack
} from "../src";

const app = new cdk.App();

// 1. Create Networking Stack (VPC, subnets, security groups)
const networkingStack = new NetworkingStack(app, "MyAppNetworking", {
    cidr: "10.0.0.0/16",
    maxAzs: 2,
});

// 2. Create Authentication Stack (Cognito)
const authStack = new AuthStack(app, "MyAppAuth", {
    userPoolName: "MyAppUsers",
    allowSelfRegistration: true,
    passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
    },
    mfaConfig: "OPTIONAL",
});

// 3. Create API Gateway Stack
const apiStack = new ApiGatewayStack(app, "MyAppApi", {
    apiName: "MyAppAPI",
    stageName: "prod",
    cors: true,
    // Integrate with Cognito for authentication
    cognitoUserPool: authStack.userPool,
});

// 4. Create Database Stack
const dbStack = new DatabaseStack(app, "MyAppDatabase");

// Add tables with automatic API generation
dbStack.addDynamoDBTable({
    tableName: "Users",
    partitionKey: { name: "id", type: cdk.aws_dynamodb.AttributeType.STRING },
    apiConfig: {
        enableRestApi: true,
        apiGatewayStack: apiStack,
    },
});

dbStack.addDynamoDBTable({
    tableName: "Posts",
    partitionKey: { name: "userId", type: cdk.aws_dynamodb.AttributeType.STRING },
    sortKey: { name: "postId", type: cdk.aws_dynamodb.AttributeType.STRING },
    apiConfig: {
        enableRestApi: true,
        apiGatewayStack: apiStack,
    },
});

// 5. Create File Stack for file management
const fileStack = new FileStack(app, "MyAppFiles", {
    serviceName: "MyApp",
    vpc: networkingStack.vpc,
    subnets: networkingStack.privateSubnets,
    securityGroup: networkingStack.lambdaSecurityGroup,
    apiGateway: apiStack.api,
    jwtAuth: {
        userPoolId: authStack.userPool.userPoolId,
        clientId: authStack.userPoolClient.userPoolClientId,
    },
    storageConfig: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedFileTypes: ["image/jpeg", "image/png", "image/gif", "application/pdf"],
        enableVersioning: true,
    },
    corsConfig: {
        allowOrigins: ["https://myapp.com", "https://www.myapp.com"],
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
    },
});

// 6. Create Serverless Stack for additional business logic
const serverlessStack = new ServerlessStack(app, "MyAppServerless");

// Create a Lambda function that can access private files
const dataProcessorFunction = serverlessStack.createNodejsFunction(
    "DataProcessor",
    "./src/handlers/data-processor",
    "handler",
    {
        vpc: networkingStack.vpc,
        vpcSubnets: { subnets: networkingStack.privateSubnets },
        securityGroups: [networkingStack.lambdaSecurityGroup],
        environment: {
            PRIVATE_BUCKET: fileStack.privateBucket.bucketName,
        },
    }
);

// Grant the data processor access to private files
fileStack.grantPrivateFileAccess(dataProcessorFunction);

// 7. Create Web Stack for frontend hosting
const webStack = new WebStack(app, "MyAppWeb", {
    appName: "MyApp",
    buildPath: "./frontend/dist", // Path to your built React/Vue/Angular app
    spaMode: true, // Enable SPA routing
    domain: {
        domainName: "myapp.com",
    // hostedZoneId: "Z1234567890", // Optional: specify if you have multiple zones
    },
    cloudFrontSettings: {
        priceClass: cdk.aws_cloudfront.PriceClass.PRICE_CLASS_100,
        enableLogging: true,
    },
    // Integrate API Gateway with CloudFront
    apiBehaviors: [
        {
            pathPattern: "/api/*",
            origin: new origins.RestApiOrigin(apiStack.api),
            allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cdk.aws_cloudfront.CachePolicy.CACHING_DISABLED,
        },
    ],
});

// Stack dependencies
authStack.addDependency(networkingStack);
apiStack.addDependency(authStack);
dbStack.addDependency(apiStack);
fileStack.addDependency(apiStack);
serverlessStack.addDependency(networkingStack);
webStack.addDependency(apiStack);

// Output important information
new cdk.CfnOutput(app, "WebsiteURL", {
    value: `https://${webStack.domainName}`,
    description: "Main website URL",
});

new cdk.CfnOutput(app, "ApiURL", {
    value: apiStack.api.url,
    description: "API Gateway URL",
});

new cdk.CfnOutput(app, "UserPoolId", {
    value: authStack.userPool.userPoolId,
    description: "Cognito User Pool ID",
});

new cdk.CfnOutput(app, "UserPoolClientId", {
    value: authStack.userPoolClient.userPoolClientId,
    description: "Cognito User Pool Client ID",
});
