import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Construct } from "constructs";
import { ApiGatewayStack } from "./api-gateway-stack";

export interface DynamoDBTableProps {
    tableName: string;
    partitionKey: {
        name: string;
        type: dynamodb.AttributeType;
    };
    sortKey?: {
        name: string;
        type: dynamodb.AttributeType;
    };
    billingMode?: dynamodb.BillingMode;
    readCapacity?: number;
    writeCapacity?: number;
    pointInTimeRecovery?: boolean;
    ttlAttributeName?: string;
    globalSecondaryIndexes?: {
        indexName: string;
        partitionKey: {
            name: string;
            type: dynamodb.AttributeType;
        };
        sortKey?: {
            name: string;
            type: dynamodb.AttributeType;
        };
        projectionType?: dynamodb.ProjectionType;
    }[];
    apiConfig?: {
        enableRestApi?: boolean;
        enableWebSocket?: boolean;
        apiGatewayStack?: ApiGatewayStack;
        websocketApiName?: string;
    };
}

export class DatabaseStack extends cdk.Stack {
    public readonly tables: Record<string, dynamodb.Table> = {};
    public readonly tableLambdas: Record<string, {
        create: lambda.Function;
        read: lambda.Function;
        update: lambda.Function;
        delete: lambda.Function;
    }> = {};
    public readonly websocketApis: Record<string, apigatewayv2.WebSocketApi> = {};

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    }

    public addDynamoDBTable(props: DynamoDBTableProps): dynamodb.Table {
        const table = new dynamodb.Table(this, props.tableName, {
            tableName: props.tableName,
            partitionKey: props.partitionKey,
            sortKey: props.sortKey,
            billingMode: props.billingMode || dynamodb.BillingMode.PAY_PER_REQUEST,
            readCapacity: props.readCapacity,
            writeCapacity: props.writeCapacity,
            pointInTimeRecovery: props.pointInTimeRecovery || false,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            timeToLiveAttribute: props.ttlAttributeName,
        });

        // Add GSIs if specified
        if (props.globalSecondaryIndexes) {
            for (const gsi of props.globalSecondaryIndexes) {
                table.addGlobalSecondaryIndex({
                    indexName: gsi.indexName,
                    partitionKey: gsi.partitionKey,
                    sortKey: gsi.sortKey,
                    projectionType: gsi.projectionType || dynamodb.ProjectionType.ALL,
                });
            }
        }

        // Store the table reference
        this.tables[props.tableName] = table;

        // Create API endpoints if requested
        if (props.apiConfig) {
            this.createTableApis(table, props);
        }

        // Export the table name and ARN
        new cdk.CfnOutput(this, `${props.tableName}TableName`, {
            value: table.tableName,
            exportName: `${this.stackName}-${props.tableName}-TableName`,
        });

        new cdk.CfnOutput(this, `${props.tableName}TableArn`, {
            value: table.tableArn,
            exportName: `${this.stackName}-${props.tableName}-TableArn`,
        });

        return table;
    }

    private createTableApis(table: dynamodb.Table, props: DynamoDBTableProps) {
        const { apiConfig } = props;
        if (!apiConfig) return;

        // Create CRUD Lambda functions
        const lambdas = this.createCrudLambdas(table, props.tableName);
        this.tableLambdas[props.tableName] = lambdas;

        // Create REST API endpoints
        if (apiConfig.enableRestApi && apiConfig.apiGatewayStack) {
            this.createRestApiEndpoints(apiConfig.apiGatewayStack, props.tableName, lambdas);
        }

        // Create WebSocket API
        if (apiConfig.enableWebSocket) {
            this.createWebSocketApi(props.tableName, lambdas, apiConfig.websocketApiName);
        }
    }

    private createCrudLambdas(table: dynamodb.Table, tableName: string) {
        const createdStatusCode = 201;
        const successStatusCode = 200;
        const createLambda = new lambda.Function(this, `${tableName}CreateLambda`, {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "index.handler",
            code: lambda.Code.fromInline(`
                const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
                const client = new DynamoDBClient();

                exports.handler = async (event) => {
                    const body = JSON.parse(event.body || "{}");
                    await client.send(new PutItemCommand({
                        TableName: process.env.TABLE_NAME,
                        Item: body
                    }));
                    return { statusCode: ${createdStatusCode}, body: JSON.stringify({ success: true }) };
                };
            `),
            environment: { TABLE_NAME: table.tableName },
        });

        const readLambda = new lambda.Function(this, `${tableName}ReadLambda`, {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "index.handler",
            code: lambda.Code.fromInline(`
                const { DynamoDBClient, GetItemCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
                const client = new DynamoDBClient();

                exports.handler = async (event) => {
                    const id = event.pathParameters?.id;
                    if (id) {
                        const result = await client.send(new GetItemCommand({
                            TableName: process.env.TABLE_NAME,
                            Key: { id: { S: id } }
                        }));
                        return { statusCode: ${successStatusCode}, body: JSON.stringify(result.Item) };
                    } else {
                        const result = await client.send(new ScanCommand({ TableName: process.env.TABLE_NAME }));
                        return { statusCode: ${successStatusCode}, body: JSON.stringify(result.Items) };
                    }
                };
            `),
            environment: { TABLE_NAME: table.tableName },
        });

        const updateLambda = new lambda.Function(this, `${tableName}UpdateLambda`, {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "index.handler",
            code: lambda.Code.fromInline(`
                const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
                const client = new DynamoDBClient();

                exports.handler = async (event) => {
                    const id = event.pathParameters.id;
                    const body = JSON.parse(event.body);
                    await client.send(new UpdateItemCommand({
                        TableName: process.env.TABLE_NAME,
                        Key: { id: { S: id } },
                        UpdateExpression: "SET #data = :data",
                        ExpressionAttributeNames: { "#data": "data" },
                        ExpressionAttributeValues: { ":data": { S: JSON.stringify(body) } }
                    }));
                    return { statusCode: ${successStatusCode}, body: JSON.stringify({ success: true }) };
                };
            `),
            environment: { TABLE_NAME: table.tableName },
        });

        const deleteLambda = new lambda.Function(this, `${tableName}DeleteLambda`, {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "index.handler",
            code: lambda.Code.fromInline(`
                const { DynamoDBClient, DeleteItemCommand } = require("@aws-sdk/client-dynamodb");
                const client = new DynamoDBClient();

                exports.handler = async (event) => {
                    const id = event.pathParameters.id;
                    await client.send(new DeleteItemCommand({
                        TableName: process.env.TABLE_NAME,
                        Key: { id: { S: id } }
                    }));
                    return { statusCode: ${successStatusCode}, body: JSON.stringify({ success: true }) };
                };
            `),
            environment: { TABLE_NAME: table.tableName },
        });

        // Grant permissions
        table.grantReadWriteData(createLambda);
        table.grantReadData(readLambda);
        table.grantReadWriteData(updateLambda);
        table.grantReadWriteData(deleteLambda);

        return { create: createLambda, read: readLambda, update: updateLambda, delete: deleteLambda };
    }

    private createRestApiEndpoints(apiStack: ApiGatewayStack, tableName: string, lambdas: any) {
        const resource = apiStack.api.root.addResource(tableName.toLowerCase());
        const itemResource = resource.addResource("{id}");

        resource.addMethod("POST", new apigateway.LambdaIntegration(lambdas.create));
        resource.addMethod("GET", new apigateway.LambdaIntegration(lambdas.read));
        itemResource.addMethod("GET", new apigateway.LambdaIntegration(lambdas.read));
        itemResource.addMethod("PUT", new apigateway.LambdaIntegration(lambdas.update));
        itemResource.addMethod("DELETE", new apigateway.LambdaIntegration(lambdas.delete));
    }

    private createWebSocketApi(tableName: string, lambdas: any, apiName?: string) {
        const wsApi = new apigatewayv2.WebSocketApi(this, `${tableName}WebSocketApi`, {
            apiName: apiName || `${tableName}-websocket`,
            description: `WebSocket API for ${tableName}`,
        });

        // WebSocket Lambda for real-time operations
        const successStatusCode = 200;
        const wsLambda = new lambda.Function(this, `${tableName}WebSocketLambda`, {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "index.handler",
            code: lambda.Code.fromInline(`
                const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

                exports.handler = async (event) => {
                    const { routeKey, connectionId } = event.requestContext;
                    const body = JSON.parse(event.body || "{}");

                    // Handle different WebSocket routes
                    switch (routeKey) {
                        case "create":
                        case "update":
                        case "delete":
                            // Broadcast changes to all connected clients
                            const client = new ApiGatewayManagementApiClient({
                                endpoint: \`https://\${event.requestContext.domainName}/\${event.requestContext.stage}\`
                            });

                            await client.send(new PostToConnectionCommand({
                                ConnectionId: connectionId,
                                Data: JSON.stringify({ action: routeKey, data: body })
                            }));
                            break;
                    }

                    return { statusCode: ${successStatusCode} };
                };
            `),
        });

        wsApi.addRoute("create", { integration: new integrations.WebSocketLambdaIntegration("CreateIntegration", wsLambda) });
        wsApi.addRoute("update", { integration: new integrations.WebSocketLambdaIntegration("UpdateIntegration", wsLambda) });
        wsApi.addRoute("delete", { integration: new integrations.WebSocketLambdaIntegration("DeleteIntegration", wsLambda) });

        new apigatewayv2.WebSocketStage(this, `${tableName}WebSocketStage`, {
            webSocketApi: wsApi,
            stageName: "prod",
            autoDeploy: true,
        });

        this.websocketApis[tableName] = wsApi;

        new cdk.CfnOutput(this, `${tableName}WebSocketUrl`, {
            value: wsApi.apiEndpoint,
            exportName: `${this.stackName}-${tableName}-WebSocketUrl`,
        });
    }
}
