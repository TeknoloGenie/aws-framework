# BaseLambda

The `BaseLambda` class serves as the foundation for all Lambda function implementations in the AWS Framework.

## Overview

This abstract class provides a structured lifecycle for AWS Lambda functions with initialization, processing, error handling, and cleanup phases. It enforces a consistent pattern across all Lambda implementations while allowing for specialized behavior in subclasses.

## Class Definition

```typescript
export abstract class BaseLambda<TEvent, TResult>
```

### Type Parameters

- `TEvent`: The type of event that triggers the Lambda function
- `TResult`: The type of result returned by the Lambda function

## Key Methods

### `handler(event: TEvent, context: Context): Promise<TResult>`

The main entry point for AWS Lambda. This method:
1. Stores the Lambda context
2. Initializes resources
3. Processes the event
4. Handles any errors
5. Performs cleanup

### `initialize(event: TEvent): Promise<void>`

Optional method to set up resources before processing the event. Override in subclasses as needed.

### `process(event: TEvent): Promise<TResult>`

Abstract method that must be implemented by subclasses to define the main processing logic.

### `handleError(error: Error | unknown): Promise<TResult>`

Abstract method that must be implemented by subclasses to define error handling behavior.

### `cleanup(): Promise<void>`

Optional method to release resources after processing. Override in subclasses as needed.

## Usage Example

```typescript
import { BaseLambda } from 'aws-framework';
import { S3Event } from 'aws-lambda';

class MyLambda extends BaseLambda<S3Event, void> {
  protected async process(event: S3Event): Promise<void> {
    // Process S3 event
  }

  protected async handleError(error: unknown): Promise<void> {
    console.error('Error processing S3 event:', error);
  }
}

export const handler = new MyLambda().handler.bind(new MyLambda());
```

## Best Practices

- Use the `initialize` method to set up database connections, load configurations, or prepare other resources
- Keep the `process` method focused on the core business logic
- Implement proper error handling in the `handleError` method
- Use the `cleanup` method to close connections and free resources