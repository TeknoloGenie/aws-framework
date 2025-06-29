import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { AuthStack } from "./auth-stack";
import { DatabaseStack } from "./database-stack";
import { MonitoringStack } from "./monitoring-stack";
import { NetworkingStack } from "./networking-stack";

export interface ApplicationStackProps extends cdk.StackProps {
    appName: string;
    environment: string;
    alarmEmail?: string;
}

export class ApplicationStack extends cdk.Stack {
    public readonly authStack: AuthStack;
    public readonly databaseStack: DatabaseStack;
    public readonly monitoringStack: MonitoringStack;
    public readonly networkingStack: NetworkingStack;
    public readonly api: apigateway.RestApi;

    constructor(scope: Construct, id: string, props: ApplicationStackProps) {
        super(scope, id, props);

        // Create Networking Stack
        const maxAzs = 2;
        const natGateways = 1;
        this.networkingStack = new NetworkingStack(this, `${props.appName}-Networking`, {
            cidr: "10.0.0.0/16",
            maxAzs,
            natGateways,
        });

        // Create Auth Stack
        this.authStack = new AuthStack(this, `${props.appName}-Auth`, {
            userPoolName: `${props.appName}-UserPool`,
            clientName: `${props.appName}-Client`,
            domainPrefix: `${props.appName.toLowerCase()}-${props.environment}`,
            selfSignUpEnabled: true,
            standardAttributes: {
                email: { required: true, mutable: true },
                givenName: { required: true, mutable: true },
                familyName: { required: true, mutable: true },
            },
        });

        // Create Database Stack
        this.databaseStack = new DatabaseStack(this, `${props.appName}-Database`);

        // Add tables to the database stack
        const userTable = this.databaseStack.addDynamoDBTable({
            tableName: `${props.appName}-Users`,
            partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
            pointInTimeRecovery: true,
            globalSecondaryIndexes: [{
                indexName: "EmailIndex",
                partitionKey: { name: "email", type: dynamodb.AttributeType.STRING },
            }],
        });

        const dataTable = this.databaseStack.addDynamoDBTable({
            tableName: `${props.appName}-Data`,
            partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
            sortKey: { name: "timestamp", type: dynamodb.AttributeType.NUMBER },
            pointInTimeRecovery: true,
            ttlAttributeName: "expiresAt",
        });

        // Create Monitoring Stack
        this.monitoringStack = new MonitoringStack(this, `${props.appName}-Monitoring`, {
            alarmEmail: props.alarmEmail,
        });

        // Create Lambda functions that use all the stacks
        const successStatusCode = 200;
        const apiLambda = new lambda.Function(this, "ApiLambda", {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: "index.handler",
            code: lambda.Code.fromInline(`
                exports.handler = async (event) => {
                    return {
                        statusCode: ${successStatusCode},
                        body: JSON.stringify({ message: "Hello from ${props.appName}!" }),
                    };
                };
            `),
            environment: {
                USER_POOL_ID: this.authStack.userPool.userPoolId,
                USER_TABLE_NAME: userTable.tableName,
                DATA_TABLE_NAME: dataTable.tableName,
            },
            vpc: this.networkingStack.vpc,
            vpcSubnets: {
                subnets: this.networkingStack.vpc.privateSubnets,
            },
        });

        // Grant permissions
        userTable.grantReadWriteData(apiLambda);
        dataTable.grantReadWriteData(apiLambda);

        // Create API Gateway
        this.api = new apigateway.RestApi(this, "Api", {
            restApiName: `${props.appName} API`,
            description: `API for ${props.appName}`,
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
            },
        });

        // Add Cognito authorizer
        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "Authorizer", {
            cognitoUserPools: [this.authStack.userPool],
        });

        // Add API routes
        const apiResource = this.api.root.addResource("api");
        apiResource.addMethod("GET", new apigateway.LambdaIntegration(apiLambda), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // Set up monitoring
        const durationThreshold = 5000;
        this.monitoringStack.createLambdaErrorAlarm(apiLambda);
        this.monitoringStack.createLambdaDurationAlarm(apiLambda, durationThreshold);
        this.monitoringStack.createDashboard(`${props.appName}-Dashboard`, [apiLambda]);

        // Add Identity Pool for fine-grained access
        this.authStack.addIdentityPool(`${props.appName}-IdentityPool`);

        // Outputs
        new cdk.CfnOutput(this, "ApiUrl", {
            value: this.api.url,
            description: "API Gateway URL",
        });

        new cdk.CfnOutput(this, "VpcId", {
            value: this.networkingStack.vpc.vpcId,
            description: "VPC ID",
        });
    }
}
