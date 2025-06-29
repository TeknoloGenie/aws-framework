# DynamoDB Utilities

This module provides DynamoDB utilities for Lambda functions, including a middleware for easy access to DynamoDB and a service class for common DynamoDB operations.

## Overview

The module includes two main components:
1. `dynamoDb`: A middleware that provides a DynamoDB DocumentClient in the Lambda context
2. `DynamoDBService`: A service class that wraps the DynamoDB DocumentClient with typed methods

## DynamoDB Middleware

### Function Definition

```typescript
export const dynamoDb = (options: DynamoDBOptions = {}): middy.MiddlewareObject<any, any>
```

### DynamoDBOptions Interface

```typescript
export interface DynamoDBOptions {
  instance?: DynamoDBDocumentClient;  // Optional existing DocumentClient instance
  setToContext?: boolean;             // Whether to set the client to the context (default: true)
}
```

### Features

- **DocumentClient Creation**: Creates a DynamoDB DocumentClient or uses a provided instance
- **Context Integration**: Adds the DocumentClient to the Lambda context

## DynamoDBService Class

### Class Definition

```typescript
export class DynamoDBService {
  constructor(options: { region?: string } = {})
}
```

### Methods

- `get<T>(params: GetCommandInput): Promise<T | null>`
- `put(params: PutCommandInput): Promise<PutCommandOutput>`
- `update(params: UpdateCommandInput): Promise<UpdateCommandOutput>`
- `delete(params: DeleteCommandInput): Promise<DeleteCommandOutput>`
- `query<T>(params: QueryCommandInput): Promise<T[]>`
- `scan<T>(params: ScanCommandInput): Promise<T[]>`
- `batchGet<T>(params: BatchGetCommandInput): Promise<Record<string, T[]>>`
- `batchWrite(params: BatchWriteCommandInput): Promise<BatchWriteCommandOutput>`
- `transactWrite(params: TransactWriteCommandInput): Promise<TransactWriteCommandOutput>`
- `transactGet<T>(params: TransactGetCommandInput): Promise<T[]>`

### Features

- **Type Safety**: Generic type parameters for strongly typed results
- **Simplified API**: Wraps the AWS SDK with more convenient methods
- **Promise-Based**: All methods return promises for easy async/await usage
- **Null Handling**: Returns null or empty arrays instead of undefined

## Usage Examples

### Using the Middleware

```typescript
import middy from 'middy';
import { dynamoDb } from 'aws-framework';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

const baseHandler = async (event, context) => {
  // Access the DynamoDB client from the context
  const { dynamoDB } = context;
  
  // Use the client to interact with DynamoDB
  const command = new GetCommand({
    TableName: 'Users',
    Key: {
      userId: event.pathParameters.userId
    }
  });
  
  const result = await dynamoDB.send(command);
  
  if (!result.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'User not found' })
    };
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify(result.Item)
  };
};

// Apply the DynamoDB middleware
export const handler = middy(baseHandler)
  .use(dynamoDb());
```

### Using the DynamoDBService Class

```typescript
import { DynamoDBService } from 'aws-framework';

interface User {
  userId: string;
  name: string;
  email: string;
  createdAt: number;
}

const dynamoDBService = new DynamoDBService({ region: 'us-east-1' });

// Get a user by ID
async function getUser(userId: string): Promise<User | null> {
  return await dynamoDBService.get<User>({
    TableName: 'Users',
    Key: { userId }
  });
}

// Query users by email domain
async function getUsersByEmailDomain(domain: string): Promise<User[]> {
  return await dynamoDBService.query<User>({
    TableName: 'Users',
    IndexName: 'EmailIndex',
    KeyConditionExpression: 'emailDomain = :domain',
    ExpressionAttributeValues: {
      ':domain': domain
    }
  });
}

// Create a new user
async function createUser(user: User): Promise<void> {
  await dynamoDBService.put({
    TableName: 'Users',
    Item: user
  });
}

// Update a user
async function updateUser(userId: string, name: string): Promise<void> {
  await dynamoDBService.update({
    TableName: 'Users',
    Key: { userId },
    UpdateExpression: 'SET #name = :name',
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':name': name
    }
  });
}

// Delete a user
async function deleteUser(userId: string): Promise<void> {
  await dynamoDBService.delete({
    TableName: 'Users',
    Key: { userId }
  });
}
```

### Using Both Together

```typescript
import middy from 'middy';
import { dynamoDb, DynamoDBService } from 'aws-framework';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Create a service class that uses the middleware-provided client
class UserService {
  private dynamoDB: DynamoDBDocumentClient;
  
  constructor(dynamoDB: DynamoDBDocumentClient) {
    this.dynamoDB = dynamoDB;
  }
  
  async getUser(userId: string): Promise<any> {
    const command = new GetCommand({
      TableName: 'Users',
      Key: { userId }
    });
    
    const result = await this.dynamoDB.send(command);
    return result.Item;
  }
}

const baseHandler = async (event, context) => {
  // Create a service using the context-provided client
  const userService = new UserService(context.dynamoDB);
  
  // Use the service
  const user = await userService.getUser(event.pathParameters.userId);
  
  if (!user) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'User not found' })
    };
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify(user)
  };
};

// Apply the DynamoDB middleware
export const handler = middy(baseHandler)
  .use(dynamoDb());
```

## Best Practices

- Use the middleware when you need the DynamoDB client in multiple places in your Lambda
- Use the service class for more complex applications with multiple DynamoDB operations
- Use the generic type parameters for better type safety
- Consider creating domain-specific service classes that use DynamoDBService internally
- Use batch operations when working with multiple items for better performance
- Use transactions when you need atomicity across multiple operations
- Use the AWS SDK v3's modular approach for better tree-shaking and smaller bundle sizes