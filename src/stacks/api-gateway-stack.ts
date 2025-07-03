import * as cdk from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

export interface CorsOptions {
  allowOrigins?: string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  allowCredentials?: boolean;
}

export interface AuthorizerOptions {
  type: "COGNITO_USER_POOLS" | "LAMBDA" | "IAM";
  authorizerName: string;
  userPools?: cognito.UserPool[];
  lambdaFunction?: lambda.Function;
}

export interface ApiGatewayStackProps extends cdk.StackProps {
  stageName?: string;
  cors?: boolean | CorsOptions;
  apiName: string;
  defaultAuthorizer?: AuthorizerOptions;
}

export class ApiGatewayStack extends cdk.Stack {
    public readonly api: apigateway.RestApi;
    public readonly defaultAuthorizer?: apigateway.IAuthorizer;

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
            defaultCorsPreflightOptions: this.getCorsOptions(props.cors),
        });

        // Create default authorizer if specified
        if (props.defaultAuthorizer) {
            this.defaultAuthorizer = this.createAuthorizer(props.defaultAuthorizer);
        }

        // Export API Gateway URL
        new cdk.CfnOutput(this, "ApiUrl", {
            value: this.api.url,
            exportName: `${id}-ApiUrl`,
        });
    }

    private getCorsOptions(cors?: boolean | CorsOptions): apigateway.CorsOptions | undefined {
        if (!cors) return undefined;

        if (cors === true) {
            return {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key"],
                allowCredentials: true,
            };
        }

        return {
            allowOrigins: cors.allowOrigins || apigateway.Cors.ALL_ORIGINS,
            allowMethods: cors.allowMethods || apigateway.Cors.ALL_METHODS,
            allowHeaders: cors.allowHeaders || ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key"],
            allowCredentials: cors.allowCredentials !== false,
        };
    }

    private createAuthorizer(options: AuthorizerOptions): apigateway.IAuthorizer {
        switch (options.type) {
        case "COGNITO_USER_POOLS":
            if (!options.userPools || options.userPools.length === 0) {
                throw new Error("User pools are required for Cognito authorizer");
            }
            return new apigateway.CognitoUserPoolsAuthorizer(this, options.authorizerName, {
                cognitoUserPools: options.userPools,
                authorizerName: options.authorizerName
            });

        case "LAMBDA":
            if (!options.lambdaFunction) {
                throw new Error("Lambda function is required for Lambda authorizer");
            }
            return new apigateway.TokenAuthorizer(this, options.authorizerName, {
                handler: options.lambdaFunction,
                authorizerName: options.authorizerName
            });

        case "IAM":
            return new apigateway.AwsIamAuthorizer();

        default:
            throw new Error(`Unsupported authorizer type: ${options.type}`);
        }
    }

    public addLambdaIntegration(
        path: string,
        method: string,
        lambdaFunction: lambda.Function,
        options?: apigateway.MethodOptions
    ): apigateway.Method {
        const resource = this.getOrCreateResource(path);

        const methodOptions: apigateway.MethodOptions = {
            authorizer: this.defaultAuthorizer,
            ...options
        };

        return resource.addMethod(
            method,
            new apigateway.LambdaIntegration(lambdaFunction, {
                proxy: true,
            }),
            methodOptions
        );
    }

    public addLambdaIntegrationWithoutAuth(
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
            {
                authorizationType: apigateway.AuthorizationType.NONE,
                ...options
            }
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
