# Mock Event Generators

The Mock Event Generators module provides utilities for creating mock AWS Lambda event objects for testing.

## Overview

This module includes functions for generating mock events for various AWS Lambda triggers, including API Gateway, SQS, SNS, DynamoDB Streams, S3, and EventBridge.

## Functions

### `createApiGatewayEvent(options?: object): APIGatewayProxyEvent`

Creates a mock API Gateway REST API event.

#### Options:
- `path`: The request path (default: '/')
- `httpMethod`: The HTTP method (default: 'GET')
- `headers`: Request headers (default: {})
- `queryStringParameters`: Query string parameters (default: null)
- `pathParameters`: Path parameters (default: null)
- `body`: Request body (default: null)
- `isBase64Encoded`: Whether the body is base64 encoded (default: false)

### `createHttpApiEvent(options?: object): APIGatewayProxyEventV2`

Creates a mock API Gateway HTTP API (v2) event.

#### Options:
- `path`: The request path (default: '/')
- `method`: The HTTP method (default: 'GET')
- `headers`: Request headers (default: {})
- `queryStringParameters`: Query string parameters (default: {})
- `pathParameters`: Path parameters (default: {})
- `body`: Request body (default: null)
- `isBase64Encoded`: Whether the body is base64 encoded (default: false)

### `createSqsEvent(messages: any[]): SQSEvent`

Creates a mock SQS event with the specified messages.

#### Parameters:
- `messages`: Array of message objects or strings

### `createSnsEvent(messages: any[]): SNSEvent`

Creates a mock SNS event with the specified messages.

#### Parameters:
- `messages`: Array of message objects or strings

### `createDynamoDBStreamEvent(records: object[]): DynamoDBStreamEvent`

Creates a mock DynamoDB Stream event.

#### Parameters:
- `records`: Array of record objects with the following properties:
  - `eventName`: 'INSERT', 'MODIFY', or 'REMOVE'
  - `oldImage`: Optional record before the change
  - `newImage`: Optional record after the change

### `createS3Event(records: object[]): S3Event`

Creates a mock S3 event.

#### Parameters:
- `records`: Array of record objects with the following properties:
  - `bucket`: S3 bucket name
  - `key`: S3 object key
  - `eventName`: Optional event name (default: 'ObjectCreated:Put')
  - `size`: Optional object size (default: 1024)

### `createEventBridgeEvent<T>(source: string, detailType: string, detail: T): EventBridgeEvent<string, T>`

Creates a mock EventBridge event.

#### Parameters:
- `source`: Event source
- `detailType`: Event detail type
- `detail`: Event detail object

## Usage Examples

### API Gateway REST API Event

```typescript
import { createApiGatewayEvent } from 'aws-framework';
import { handler } from '../src/handlers/api-handler';

describe('API Handler', () => {
  test('should handle GET request', async () => {
    const event = createApiGatewayEvent({
      path: '/users',
      httpMethod: 'GET',
      queryStringParameters: {
        limit: '10',
        offset: '0'
      }
    });
    
    const result = await handler(event, {} as any);
    
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toHaveProperty('users');
  });
  
  test('should handle POST request', async () => {
    const event = createApiGatewayEvent({
      path: '/users',
      httpMethod: 'POST',
      body: {
        name: 'John Doe',
        email: 'john@example.com'
      }
    });
    
    const result = await handler(event, {} as any);
    
    expect(result.statusCode).toBe(201);
    expect(JSON.parse(result.body)).toHaveProperty('id');
  });
});
```

### API Gateway HTTP API Event

```typescript
import { createHttpApiEvent } from 'aws-framework';
import { handler } from '../src/handlers/http-api-handler';

describe('HTTP API Handler', () => {
  test('should handle GET request', async () => {
    const event = createHttpApiEvent({
      path: '/products',
      method: 'GET',
      queryStringParameters: {
        category: 'electronics'
      }
    });
    
    const result = await handler(event, {} as any);
    
    expect(result.statusCode).toBe(200);
  });
});
```

### SQS Event

```typescript
import { createSqsEvent } from 'aws-framework';
import { handler } from '../src/handlers/sqs-handler';

describe('SQS Handler', () => {
  test('should process SQS messages', async () => {
    const event = createSqsEvent([
      { orderId: '123', status: 'pending' },
      { orderId: '456', status: 'processing' }
    ]);
    
    await handler(event, {} as any);
    
    // Assert that the messages were processed correctly
  });
});
```

### DynamoDB Stream Event

```typescript
import { createDynamoDBStreamEvent } from 'aws-framework';
import { handler } from '../src/handlers/dynamodb-stream-handler';

describe('DynamoDB Stream Handler', () => {
  test('should handle INSERT events', async () => {
    const event = createDynamoDBStreamEvent([
      {
        eventName: 'INSERT',
        newImage: {
          id: 'user123',
          name: 'John Doe',
          email: 'john@example.com'
        }
      }
    ]);
    
    await handler(event, {} as any);
    
    // Assert that the INSERT event was processed correctly
  });
  
  test('should handle MODIFY events', async () => {
    const event = createDynamoDBStreamEvent([
      {
        eventName: 'MODIFY',
        oldImage: {
          id: 'user123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        newImage: {
          id: 'user123',
          name: 'John Doe',
          email: 'john.doe@example.com'
        }
      }
    ]);
    
    await handler(event, {} as any);
    
    // Assert that the MODIFY event was processed correctly
  });
});
```

### S3 Event

```typescript
import { createS3Event } from 'aws-framework';
import { handler } from '../src/handlers/s3-handler';

describe('S3 Handler', () => {
  test('should process S3 events', async () => {
    const event = createS3Event([
      {
        bucket: 'my-bucket',
        key: 'uploads/image.jpg',
        eventName: 'ObjectCreated:Put',
        size: 1024 * 1024 // 1MB
      }
    ]);
    
    await handler(event, {} as any);
    
    // Assert that the S3 event was processed correctly
  });
});
```

### EventBridge Event

```typescript
import { createEventBridgeEvent } from 'aws-framework';
import { handler } from '../src/handlers/eventbridge-handler';

interface PaymentEvent {
  orderId: string;
  amount: number;
  status: string;
}

describe('EventBridge Handler', () => {
  test('should process payment events', async () => {
    const event = createEventBridgeEvent<PaymentEvent>(
      'custom.payment',
      'Payment Processed',
      {
        orderId: 'order123',
        amount: 99.99,
        status: 'completed'
      }
    );
    
    await handler(event, {} as any);
    
    // Assert that the EventBridge event was processed correctly
  });
});
```

## Best Practices

- Use these generators to create realistic test events
- Customize the events to test different scenarios
- Combine with mock AWS services for comprehensive testing
- Use TypeScript generics with `createEventBridgeEvent` for type safety
- Create helper functions for common event patterns in your application