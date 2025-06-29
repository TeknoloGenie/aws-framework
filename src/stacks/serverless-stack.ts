import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface ServerlessStackProps extends cdk.StackProps {
  environment?: Record<string, string>;
  timeout?: cdk.Duration;
  memorySize?: number;
}

export class ServerlessStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: ServerlessStackProps = {}) {
        super(scope, id, props);
    }

    public createNodejsFunction(
        id: string,
        entry: string,
        handler: string = "handler",
        options: {
      environment?: Record<string, string>;
      timeout?: cdk.Duration;
      memorySize?: number;
      vpc?: cdk.aws_ec2.IVpc;
      securityGroups?: cdk.aws_ec2.ISecurityGroup[];
      layers?: lambda.ILayerVersion[];
    } = {}
    ): lambda.Function {
    // Create execution role with basic permissions
        const executionRole = new iam.Role(this, `${id}Role`, {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
            ],
        });

        // Create the Lambda function
        const lambdaFunction = new lambda.Function(this, id, {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: handler,
            code: lambda.Code.fromAsset(entry),
            environment: options.environment,
            timeout: options.timeout || cdk.Duration.seconds(30),
            memorySize: options.memorySize || 128,
            vpc: options.vpc,
            securityGroups: options.securityGroups,
            layers: options.layers,
            role: executionRole,
            logRetention: logs.RetentionDays.ONE_WEEK,
            tracing: lambda.Tracing.ACTIVE,
        });

        // Export function ARN and name
        new cdk.CfnOutput(this, `${id}FunctionArn`, {
            value: lambdaFunction.functionArn,
            exportName: `${this.stackName}-${id}-FunctionArn`,
        });

        new cdk.CfnOutput(this, `${id}FunctionName`, {
            value: lambdaFunction.functionName,
            exportName: `${this.stackName}-${id}-FunctionName`,
        });

        return lambdaFunction;
    }

    public addPermission(
        lambdaFunction: lambda.Function,
        id: string,
        principal: iam.ServicePrincipal,
        action: string = "lambda:InvokeFunction"
    ): void {
        lambdaFunction.addPermission(id, {
            principal,
            action,
        });
    }
}
