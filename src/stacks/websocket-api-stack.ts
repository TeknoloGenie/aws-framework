import * as cdk from "aws-cdk-lib";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface WebSocketApiStackProps extends cdk.StackProps {
  apiName: string;
  stageName?: string;
  enableLogging?: boolean;
}

export class WebSocketApiStack extends cdk.Stack {
    public readonly api: apigatewayv2.WebSocketApi;
    public readonly stage: apigatewayv2.WebSocketStage;

    constructor(scope: Construct, id: string, props: WebSocketApiStackProps) {
        super(scope, id, props);

        const stageName = props.stageName || "dev";

        // Create WebSocket API
        this.api = new apigatewayv2.WebSocketApi(this, "WebSocketApi", {
            apiName: props.apiName,
            description: `${props.apiName} WebSocket API`
        });

        // Create stage
        this.stage = new apigatewayv2.WebSocketStage(this, "WebSocketStage", {
            webSocketApi: this.api,
            stageName,
            autoDeploy: true
        });

        // Enable logging if requested
        if (props.enableLogging) {
            const logGroup = new logs.LogGroup(this, "WebSocketApiLogs", {
                logGroupName: `/aws/apigateway/${props.apiName}`,
                retention: logs.RetentionDays.ONE_WEEK,
                removalPolicy: cdk.RemovalPolicy.DESTROY
            });

            this.stage.node.addDependency(logGroup);
        }

        // Output the WebSocket URL
        new cdk.CfnOutput(this, "WebSocketUrl", {
            value: this.stage.url,
            description: "WebSocket API URL",
            exportName: `${id}-WebSocketUrl`
        });

        new cdk.CfnOutput(this, "WebSocketApiId", {
            value: this.api.apiId,
            description: "WebSocket API ID",
            exportName: `${id}-WebSocketApiId`
        });
    }

    /**
   * Add a Lambda integration for a specific route
   */
    public addRoute(
        routeKey: string,
        lambdaFunction: lambda.Function
    ): apigatewayv2.WebSocketRoute {
    // Grant the Lambda function permission to manage connections
        this.grantManageConnections(lambdaFunction);

        const integration = new apigatewayv2_integrations.WebSocketLambdaIntegration(
            `${routeKey}Integration`,
            lambdaFunction
        );

        return new apigatewayv2.WebSocketRoute(this, `${routeKey}Route`, {
            webSocketApi: this.api,
            routeKey,
            integration
        });
    }

    /**
   * Set up default routes (connect, disconnect, default)
   */
    public setupDefaultRoutes(lambdaFunction: lambda.Function): void {
    // Grant permissions
        this.grantManageConnections(lambdaFunction);

        const integration = new apigatewayv2_integrations.WebSocketLambdaIntegration(
            "DefaultIntegration",
            lambdaFunction
        );

        // Connect route
        this.api.addRoute("$connect", {
            integration
        });

        // Disconnect route
        this.api.addRoute("$disconnect", {
            integration
        });

        // Default route
        this.api.addRoute("$default", {
            integration
        });
    }

    /**
   * Grant a Lambda function permission to manage WebSocket connections
   */
    public grantManageConnections(lambdaFunction: lambda.Function): void {
        lambdaFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["execute-api:ManageConnections"],
                resources: [
                    `arn:aws:execute-api:${this.region}:${this.account}:${this.api.apiId}/*`
                ]
            })
        );

        // Add environment variable for the WebSocket endpoint
        lambdaFunction.addEnvironment(
            "WEBSOCKET_API_ENDPOINT",
            `https://${this.api.apiId}.execute-api.${this.region}.amazonaws.com/${this.stage.stageName}`
        );
    }

    /**
   * Create a custom authorizer for WebSocket connections
   */
    public createAuthorizer(
        id: string,
        authorizerFunction: lambda.Function
    ): apigatewayv2.WebSocketAuthorizer {
        return new apigatewayv2.WebSocketAuthorizer(this, id, {
            identitySource: ["route.request.querystring.token"],
            webSocketApi: this.api,
            type: apigatewayv2.WebSocketAuthorizerType.LAMBDA,
            authorizerUri: authorizerFunction.functionArn
        });
    }
}
