# ServerlessStack

The `ServerlessStack` class provides a CDK construct for creating and configuring Lambda functions with sensible defaults.

## Overview

This class simplifies the creation of Lambda functions with proper logging, tracing, and IAM permissions. It also exports the function ARN and name for use in other stacks.

## Class Definition

```typescript
export class ServerlessStack extends cdk.Stack
```

## Constructor

```typescript
constructor(scope: Construct, id: string, props: ServerlessStackProps = {})
```

### ServerlessStackProps Interface

```typescript
export interface ServerlessStackProps extends cdk.StackProps {
  environment?: Record<string, string>;
  timeout?: cdk.Duration;
  memorySize?: number;
}
```

## Key Methods

### `createNodejsFunction(id: string, entry: string, handler?: string, options?: object): lambda.Function`

Creates a Node.js Lambda function with sensible defaults.

#### Parameters:
- `id`: The logical ID of the Lambda function
- `entry`: The path to the Lambda function code
- `handler`: The handler function name (default: 'handler')
- `options`: Additional options for the Lambda function
  - `environment`: Environment variables
  - `timeout`: Function timeout
  - `memorySize`: Function memory size
  - `vpc`: VPC to deploy the function in
  - `securityGroups`: Security groups for the function
  - `layers`: Lambda layers to attach

#### Returns:
- The created Lambda function

### `addPermission(lambdaFunction: lambda.Function, id: string, principal: iam.ServicePrincipal, action?: string): void`

Adds a permission to the Lambda function to allow invocation by a service principal.

#### Parameters:
- `lambdaFunction`: The Lambda function to add the permission to
- `id`: The logical ID of the permission
- `principal`: The service principal to grant permission to
- `action`: The action to allow (default: 'lambda:InvokeFunction')

## Usage Example

```typescript
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ServerlessStack } from 'aws-framework';
import { NetworkingStack } from 'aws-framework';

const app = new cdk.App();

// Create networking stack
const networkingStack = new NetworkingStack(app, 'NetworkingStack');

// Create serverless stack
const serverlessStack = new ServerlessStack(app, 'ServerlessStack');

// Create a Lambda function
const helloFunction = serverlessStack.createNodejsFunction(
  'HelloFunction',
  './src/handlers/hello',
  'handler',
  {
    environment: {
      STAGE: 'dev',
      REGION: 'us-east-1'
    },
    timeout: cdk.Duration.seconds(60),
    memorySize: 256,
    vpc: networkingStack.vpc,
    securityGroups: []
  }
);

// Add permission for API Gateway to invoke the function
serverlessStack.addPermission(
  helloFunction,
  'ApiGatewayInvoke',
  new iam.ServicePrincipal('apigateway.amazonaws.com')
);
```

## Lambda Function Configuration

The Lambda functions created by this stack have the following default configuration:

- **Runtime**: Node.js 18.x
- **Timeout**: 30 seconds (configurable)
- **Memory**: 128 MB (configurable)
- **Log Retention**: 1 week
- **Tracing**: Active (AWS X-Ray)
- **IAM Role**: Basic execution role with CloudWatch Logs permissions

## CloudFormation Outputs

For each Lambda function created, the stack exports the following CloudFormation outputs:

- `{id}FunctionArn`: The ARN of the Lambda function
- `{id}FunctionName`: The name of the Lambda function

## Best Practices

- Use the `createNodejsFunction` method to create Lambda functions with consistent configuration
- Adjust the timeout and memory size based on the function's requirements
- Use environment variables for configuration that may change between environments
- Deploy functions in a VPC when they need to access private resources
- Use the `addPermission` method to grant other AWS services permission to invoke the function