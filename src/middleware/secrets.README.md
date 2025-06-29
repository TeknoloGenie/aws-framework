# Secrets Management Middleware

The secrets management middleware provides access to AWS Secrets Manager and AWS Systems Manager Parameter Store for Lambda functions.

## Overview

This middleware package includes two main components:
1. `secretsManager`: Retrieves secrets from AWS Secrets Manager
2. `parameterStore`: Retrieves parameters from AWS Systems Manager Parameter Store

Both components support caching to reduce API calls and improve performance.

## Secrets Manager Middleware

### Function Definition

```typescript
export const secretsManager = (options: SecretsManagerOptions = {}): middy.MiddlewareObject<any, any>
```

### SecretsManagerOptions Interface

```typescript
export interface SecretsManagerOptions {
  cache?: boolean;           // Whether to cache secrets (default: true)
  cacheExpiryInMs?: number;  // Cache expiry in milliseconds (default: 1 hour)
  secretsPath?: string;      // The secret ID to retrieve
  setToContext?: boolean;    // Whether to set the secret to the context (default: true)
}
```

### Features

- **Secret Retrieval**: Fetches secrets from AWS Secrets Manager
- **Caching**: Caches secrets to reduce API calls
- **JSON Parsing**: Automatically parses JSON secrets
- **Context Integration**: Adds secrets to the Lambda context

## Parameter Store Middleware

### Function Definition

```typescript
export const parameterStore = (options: ParameterStoreOptions = {}): middy.MiddlewareObject<any, any>
```

### ParameterStoreOptions Interface

```typescript
export interface ParameterStoreOptions {
  cache?: boolean;           // Whether to cache parameters (default: true)
  cacheExpiryInMs?: number;  // Cache expiry in milliseconds (default: 1 hour)
  parameterNames?: string[]; // List of parameter names to retrieve
  path?: string;             // Parameter path to retrieve parameters by path
  recursive?: boolean;       // Whether to retrieve parameters recursively (default: true)
  setToContext?: boolean;    // Whether to set parameters to the context (default: true)
}
```

### Features

- **Parameter Retrieval**: Fetches parameters from AWS Systems Manager Parameter Store
- **Batch Processing**: Efficiently retrieves parameters in batches
- **Path-Based Retrieval**: Supports retrieving parameters by path
- **Caching**: Caches parameters to reduce API calls
- **Context Integration**: Adds parameters to the Lambda context

## Usage Examples

### Secrets Manager

```typescript
import middy from 'middy';
import { secretsManager } from 'aws-framework';

const baseHandler = async (event, context) => {
  // Access the secret from the context
  const { username, password } = context.secrets;
  
  // Use the secret to connect to a database or API
  const client = await connectToDatabase(username, password);
  
  // Process the event
  const result = await processEvent(client, event);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
};

// Apply the secrets manager middleware
export const handler = middy(baseHandler)
  .use(secretsManager({
    secretsPath: 'my-application/database-credentials',
    cache: true,
    cacheExpiryInMs: 30 * 60 * 1000 // 30 minutes
  }));
```

### Parameter Store

```typescript
import middy from 'middy';
import { parameterStore } from 'aws-framework';

const baseHandler = async (event, context) => {
  // Access specific parameters from the context
  const apiKey = context.parameters['/my-app/api-key'];
  const endpoint = context.parameters['/my-app/endpoint'];
  
  // Use the parameters to make API calls
  const client = createApiClient(endpoint, apiKey);
  
  // Process the event
  const result = await processEvent(client, event);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
};

// Apply the parameter store middleware
export const handler = middy(baseHandler)
  .use(parameterStore({
    path: '/my-app/',
    recursive: true,
    cache: true
  }));
```

### Using Both Middlewares

```typescript
import middy from 'middy';
import { secretsManager, parameterStore } from 'aws-framework';

const baseHandler = async (event, context) => {
  // Access secrets and parameters from the context
  const { username, password } = context.secrets;
  const apiEndpoint = context.parameters['/my-app/api-endpoint'];
  
  // Use the secrets and parameters
  // ...
  
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};

// Apply both middlewares
export const handler = middy(baseHandler)
  .use(secretsManager({
    secretsPath: 'my-app/database'
  }))
  .use(parameterStore({
    parameterNames: ['/my-app/api-endpoint', '/my-app/api-version']
  }));
```

## Best Practices

- Use caching to reduce API calls and improve performance
- Set appropriate cache expiry times based on how frequently secrets change
- Use parameter paths with hierarchy for better organization
- Use SecureString parameter type for sensitive information in Parameter Store
- Grant Lambda functions the minimum required IAM permissions to access secrets and parameters
- Consider using different secret IDs or parameter paths for different environments
- Use the AWS SDK v3's modular approach for better tree-shaking and smaller bundle sizes