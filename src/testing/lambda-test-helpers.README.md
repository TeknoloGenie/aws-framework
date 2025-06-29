# Lambda Test Helpers

The Lambda Test Helpers module provides utilities for testing AWS Lambda functions.

## Overview

This module includes helper functions for creating mock Lambda contexts, mocking AWS SDK v3 services, and capturing console output during tests.

## Functions

### `createMockContext(overrides: Partial<Context> = {}): Context`

Creates a mock Lambda context object for testing.

#### Parameters:
- `overrides`: Optional partial Context object to override default values

#### Returns:
- A complete Lambda Context object

### `createMockHandler<TEvent, TResult>(handler: (event: TEvent, context: Context) => Promise<TResult>, mockContext: Partial<Context> = {}): (event: TEvent) => Promise<TResult>`

Creates a simplified test wrapper for a Lambda handler function.

#### Parameters:
- `handler`: The Lambda handler function to test
- `mockContext`: Optional partial Context object to override default values

#### Returns:
- A simplified function that only requires the event parameter

### `mockAwsService<T>(service: any, commandName: string, mockImplementation: (...args: any[]) => any): jest.SpyInstance`

Mocks an AWS SDK v3 service command for testing.

#### Parameters:
- `service`: The AWS service client class to mock
- `commandName`: The command class name to mock (e.g., 'GetItemCommand')
- `mockImplementation`: The mock implementation function that receives the command input

#### Returns:
- A Jest spy instance

### `wait(ms: number): Promise<void>`

Utility to wait for a specified time during tests.

#### Parameters:
- `ms`: Time to wait in milliseconds

#### Returns:
- A Promise that resolves after the specified time

### `captureConsoleOutput(): { logs: string[], restore: () => void }`

Captures console output during tests.

#### Returns:
- An object containing:
  - `logs`: Array of captured log messages
  - `restore`: Function to restore the original console methods

## Usage Examples

### Testing a Lambda Handler

```typescript
import { createMockContext, createMockHandler } from 'aws-framework';
import { handler } from '../src/handlers/my-handler';

describe('My Lambda Handler', () => {
  test('should process event correctly', async () => {
    // Create a test event
    const event = {
      httpMethod: 'GET',
      path: '/users',
      queryStringParameters: { limit: '10' }
    };
    
    // Create a mock context
    const context = createMockContext({
      functionName: 'my-function',
      awsRequestId: '123456789'
    });
    
    // Call the handler directly
    const result = await handler(event, context);
    
    // Assertions
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveProperty('users');
  });
  
  test('should handle errors correctly', async () => {
    // Create a simplified test wrapper
    const testHandler = createMockHandler(handler);
    
    // Create a test event that will cause an error
    const event = {
      httpMethod: 'GET',
      path: '/invalid'
    };
    
    // Call the simplified handler
    const result = await testHandler(event);
    
    // Assertions
    expect(result.statusCode).toBe(404);
  });
});
```

### Mocking AWS SDK v3 Services

```typescript
import { mockAwsService } from 'aws-framework';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../src/handlers/dynamodb-handler';

describe('DynamoDB Handler', () => {
  let mockDynamoSend: jest.SpyInstance;
  
  beforeEach(() => {
    // Mock the DynamoDB client send method for GetCommand
    mockDynamoSend = mockAwsService(
      DynamoDBClient,
      'GetCommand',
      (params) => {
        if (params.Key.id === 'valid-id') {
          return {
            Item: {
              id: 'valid-id',
              name: 'Test User',
              email: 'test@example.com'
            }
          };
        }
        return { Item: null };
      }
    );
  });
  
  afterEach(() => {
    mockDynamoSend.mockRestore();
  });
  
  test('should retrieve user from DynamoDB', async () => {
    const event = {
      pathParameters: {
        id: 'valid-id'
      }
    };
    
    const result = await handler(event, {} as any);
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      id: 'valid-id',
      name: 'Test User',
      email: 'test@example.com'
    });
  });
  
  test('should return 404 for non-existent user', async () => {
    const event = {
      pathParameters: {
        id: 'invalid-id'
      }
    };
    
    const result = await handler(event, {} as any);
    
    expect(result.statusCode).toBe(404);
  });
});
```

### Capturing Console Output

```typescript
import { captureConsoleOutput } from 'aws-framework';
import { handler } from '../src/handlers/logging-handler';

describe('Logging Handler', () => {
  test('should log appropriate messages', async () => {
    const { logs, restore } = captureConsoleOutput();
    
    try {
      await handler({ message: 'test' }, {} as any);
      
      expect(logs).toContain('info Processing message: test');
      expect(logs.some(log => log.includes('Completed processing'))).toBe(true);
    } finally {
      restore(); // Always restore console methods
    }
  });
  
  test('should log errors', async () => {
    const { logs, restore } = captureConsoleOutput();
    
    try {
      await handler({ error: true }, {} as any);
      
      expect(logs.some(log => log.includes('error'))).toBe(true);
    } finally {
      restore(); // Always restore console methods
    }
  });
});
```

## Best Practices

- Always restore mocks after tests to prevent test pollution
- Use `createMockContext` to create realistic Lambda contexts
- Use `mockAwsService` to avoid making real AWS API calls during tests
- Use `captureConsoleOutput` to test logging behavior
- Consider creating custom test utilities for your specific Lambda functions
- When mocking AWS SDK v3, remember that you're mocking the `send` method and checking the command type