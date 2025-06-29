import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface ApiGatewayStackProps extends cdk.StackProps {
  stageName?: string;
  cors?: boolean;
  apiName: string;
}

export class ApiGatewayStack extends cdk.Stack {
    public readonly api: apigateway.RestApi;

    constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
        super(scope, id, props);

        // Create API Gateway
        this.api = new apigateway.RestApi(this, props.apiName, {
            restApiName: props.apiName,
            description: `${props.apiName} API`,
            deployOptions: {
                stageName: props.stageName || "dev",
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                metricsEnabled: true,
                accessLogDestination: new apigateway.LogGroupLogDestination(
                    new logs.LogGroup(this, `${props.apiName}AccessLogs`, {
                        retention: logs.RetentionDays.ONE_WEEK,
                    })
                ),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
            },
            defaultCorsPreflightOptions: props.cors ? {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key"],
                allowCredentials: true,
            } : undefined,
        });

        // Export API Gateway URL
        new cdk.CfnOutput(this, "ApiUrl", {
            value: this.api.url,
            exportName: `${id}-ApiUrl`,
        });
    }

    public addLambdaIntegration(
        path: string,
        method: string,
        lambdaFunction: lambda.Function,
        options?: apigateway.MethodOptions
    ): apigateway.Method {
        const resource = this.getOrCreateResource(path);

        return resource.addMethod(
            method,
            new apigateway.LambdaIntegration(lambdaFunction, {
                proxy: true,
            }),
            options
        );
    }

    private getOrCreateResource(path: string): apigateway.Resource {
        const parts = path.split("/").filter(p => p);
        let resource: apigateway.Resource = this.api.root;

        for (const part of parts) {
            const childResource = resource.getResource(part) || resource.addResource(part);
            resource = childResource;
        }

        return resource;
    }
}
