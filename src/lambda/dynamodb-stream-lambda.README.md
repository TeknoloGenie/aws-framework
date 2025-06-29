# DynamoDBStreamLambda

The `DynamoDBStreamLambda` class extends the base Lambda functionality to handle events from DynamoDB Streams.

## Overview

This class provides a structured approach to building Lambda functions that respond to DynamoDB table changes. It includes utilities for filtering different types of DynamoDB events (INSERT, MODIFY, REMOVE) and accessing DynamoDB data.

## Class Definition

```typescript
export abstract class DynamoDBStreamLambda extends BaseLambda<DynamoDBStreamEvent, void>
```

## Key Methods

### `processDynamoDBStream(event: DynamoDBStreamEvent): Promise<void>`

Abstract method that must be implemented by subclasses to define the DynamoDB stream processing logic.

### `process(event: DynamoDBStreamEvent): Promise<void>`

Implements the abstract `process` method from `BaseLambda`. Calls `processDynamoDBStream` to handle the DynamoDB stream event.

### `handleError(error: Error | unknown): Promise<void>`

Implements the abstract `handleError` method from `BaseLambda`. Logs the error and re-throws it.

### Utility Methods

- `getInsertRecords(event: DynamoDBStreamEvent): DynamoDBRecord[]`
  Filters and returns only the INSERT records from the event.

- `getModifyRecords(event: DynamoDBStreamEvent): DynamoDBRecord[]`
  Filters and returns only the MODIFY records from the event.

- `getRemoveRecords(event: DynamoDBStreamEvent): DynamoDBRecord[]`
  Filters and returns only the REMOVE records from the event.

## Properties

- `dynamoDB: DynamoDBDocumentClient`
  An instance of the AWS SDK v3 DynamoDB Document client for interacting with DynamoDB tables.

## Usage Example

```typescript
import { DynamoDBStreamLambda } from 'aws-framework';
import { DynamoDBStreamEvent } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export class UserActivityLambda extends DynamoDBStreamLambda {
  protected async processDynamoDBStream(event: DynamoDBStreamEvent): Promise<void> {
    // Process new users
    const insertRecords = this.getInsertRecords(event);
    for (const record of insertRecords) {
      const newUser = record.dynamodb?.NewImage;
      if (newUser) {
        await this.processNewUser(unmarshall(newUser));
      }
    }
    
    // Process user updates
    const modifyRecords = this.getModifyRecords(event);
    for (const record of modifyRecords) {
      const oldUser = record.dynamodb?.OldImage;
      const updatedUser = record.dynamodb?.NewImage;
      
      if (oldUser && updatedUser) {
        await this.processUserUpdate(
          unmarshall(oldUser),
          unmarshall(updatedUser)
        );
      }
    }
    
    // Process user deletions
    const removeRecords = this.getRemoveRecords(event);
    for (const record of removeRecords) {
      const deletedUser = record.dynamodb?.OldImage;
      if (deletedUser) {
        await this.processUserDeletion(unmarshall(deletedUser));
      }
    }
  }
  
  private async processNewUser(user: any): Promise<void> {
    // Implementation to process new user
    // For example: send welcome email, create related resources
  }
  
  private async processUserUpdate(oldUser: any, newUser: any): Promise<void> {
    // Implementation to process user update
    // For example: track changes, update related resources
  }
  
  private async processUserDeletion(user: any): Promise<void> {
    // Implementation to process user deletion
    // For example: clean up related resources
  }
}

export const handler = new UserActivityLambda().handler.bind(new UserActivityLambda());
```

## DynamoDB Stream Event Types

- `INSERT` - A new item was added to the table
- `MODIFY` - An existing item was updated
- `REMOVE` - An item was deleted from the table

## Best Practices

- Use the helper methods to filter records by event type
- Use `unmarshall` from `@aws-sdk/util-dynamodb` to convert DynamoDB attribute values to JavaScript objects
- Process DynamoDB events in batches when possible for better efficiency
- Implement proper error handling for DynamoDB operations
- Consider using DynamoDB stream filtering to only trigger on specific events or attributes
- Be mindful of the Lambda execution time limit when processing large batches of records
- Use the AWS SDK v3's modular approach for better tree-shaking and smaller bundle sizes