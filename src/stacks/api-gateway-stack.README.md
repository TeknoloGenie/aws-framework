# ApiGatewayStack

The `ApiGatewayStack` class provides a CDK construct for creating and configuring an API Gateway REST API.

## Overview

This class simplifies the creation of API Gateway REST APIs with sensible defaults for logging, metrics, and CORS configuration. It also provides utility methods for adding Lambda integrations to API endpoints.

## Class Definition

```typescript
export class ApiGatewayStack extends cdk.Stack
```

## Constructor

```typescript
constructor(scope: Construct, id: string, props: ApiGatewayStackProps)
```

### ApiGatewayStackProps Interface

```typescript
export interface ApiGatewayStackProps extends cdk.StackProps {
  stageName?: string;  // Default: 'dev'
  cors?: boolean;      // Whether to enable CORS
  apiName: string;     // Name of the API
}
```

## Properties

- `api: apigateway.RestApi`
  The API Gateway REST API instance.

## Key Methods

### `addLambdaIntegration(path: string, method: string, lambdaFunction: lambda.Function, options?: apigateway.MethodOptions): apigateway.Method`

Adds a Lambda integration to the API Gateway at the specified path and HTTP method.

#### Parameters:
- `path`: The API path (e.g., '/users' or '/users/{userId}')
- `method`: The HTTP method (e.g., 'GET', 'POST', 'PUT', 'DELETE')
- `lambdaFunction`: The Lambda function to integrate
- `options`: Optional method options

#### Returns:
- The created API Gateway method

## Usage Example

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { ApiGatewayStack } from 'aws-framework';

const app = new cdk.App();

// Create API Gateway stack
const apiStack = new ApiGatewayStack(app, 'MyApiStack', {
  apiName: 'MyServiceApi',
  cors: true,
  stageName: 'prod'
});

// Create a Lambda function
const getUsersFunction = new lambda.Function(apiStack, 'GetUsersFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/get-users')
});

// Add Lambda integration to API Gateway
apiStack.addLambdaIntegration(
  '/users',
  'GET',
  getUsersFunction
);

// Add Lambda integration with path parameters
const getUserFunction = new lambda.Function(apiStack, 'GetUserFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/get-user')
});

apiStack.addLambdaIntegration(
  '/users/{userId}',
  'GET',
  getUserFunction,
  {
    requestParameters: {
      'method.request.path.userId': true
    }
  }
);
```

## Features

- **Logging**: Configures access logs with JSON format
- **Metrics**: Enables CloudWatch metrics for the API
- **CORS**: Optional CORS configuration with sensible defaults
- **Path Creation**: Automatically creates nested API resources as needed

## Best Practices

- Use the `addLambdaIntegration` method to add Lambda functions to the API
- Enable CORS when the API needs to be accessed from web browsers
- Use path parameters for resource identifiers (e.g., `/users/{userId}`)
- Consider adding authorization to sensitive endpoints using the `options` parameter