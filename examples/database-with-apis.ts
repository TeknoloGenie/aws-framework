#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { DatabaseStack } from "../src/stacks/database-stack";
import { ApiGatewayStack } from "../src/stacks/api-gateway-stack";

const app = new cdk.App();

// Create API Gateway Stack
const apiStack = new ApiGatewayStack(app, "MyApiStack", {
    apiName: "MyAPI",
    stageName: "dev",
    cors: true,
});

// Create Database Stack with automatic API generation
const dbStack = new DatabaseStack(app, "MyDatabaseStack");

// Table with REST API only
dbStack.addDynamoDBTable({
    tableName: "Users",
    partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
    apiConfig: {
        enableRestApi: true,
        apiGatewayStack: apiStack,
    },
});

// Table with WebSocket API only
dbStack.addDynamoDBTable({
    tableName: "ChatMessages",
    partitionKey: { name: "roomId", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
    apiConfig: {
        enableWebSocket: true,
        websocketApiName: "ChatAPI",
    },
});

// Table with both REST and WebSocket APIs
dbStack.addDynamoDBTable({
    tableName: "Notifications",
    partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
    sortKey: { name: "id", type: dynamodb.AttributeType.STRING },
    apiConfig: {
        enableRestApi: true,
        enableWebSocket: true,
        apiGatewayStack: apiStack,
        websocketApiName: "NotificationsAPI",
    },
});

// Table without any API (traditional approach)
dbStack.addDynamoDBTable({
    tableName: "Analytics",
    partitionKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
    ttlAttributeName: "expiresAt",
});
