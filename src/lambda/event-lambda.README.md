# EventLambda

The `EventLambda` class extends the base Lambda functionality to handle event-driven triggers from services like SQS, SNS, and EventBridge.

## Overview

This class provides a structured approach to building Lambda functions that respond to asynchronous events from AWS services. It supports multiple event types and provides utilities for identifying the event source.

## Class Definition

```typescript
export abstract class EventLambda<TEvent extends EventType, TResult = void> extends BaseLambda<TEvent, TResult>
```

### Type Parameters

- `TEvent`: The specific event type (SQSEvent, SNSEvent, or EventBridgeEvent)
- `TResult`: The type of result returned by the Lambda function (defaults to void)

## Key Methods

### `processEvent(event: TEvent): Promise<TResult>`

Abstract method that must be implemented by subclasses to define the event processing logic.

### `process(event: TEvent): Promise<TResult>`

Implements the abstract `process` method from `BaseLambda`. Calls `processEvent` to handle the event.

### `handleError(error: Error | unknown): Promise<TResult>`

Implements the abstract `handleError` method from `BaseLambda`. Logs the error and re-throws it to let AWS handle the error based on the event source.

### Utility Methods

- `getEventSource(event: TEvent): string`
  Determines the source of the event (SQS, SNS, EventBridge, or Unknown).

## EventType Definition

```typescript
export type EventType = SQSEvent | SNSEvent | EventBridgeEvent<string, any>;
```

## Usage Examples

### SQS Event Handler

```typescript
import { EventLambda } from 'aws-framework';
import { SQSEvent } from 'aws-lambda';

export class OrderProcessorLambda extends EventLambda<SQSEvent> {
  protected async processEvent(event: SQSEvent): Promise<void> {
    for (const record of event.Records) {
      const orderData = JSON.parse(record.body);
      await this.processOrder(orderData);
    }
  }
  
  private async processOrder(orderData: any): Promise<void> {
    // Implementation to process order
  }
}

export const handler = new OrderProcessorLambda().handler.bind(new OrderProcessorLambda());
```

### EventBridge Event Handler

```typescript
import { EventLambda } from 'aws-framework';
import { EventBridgeEvent } from 'aws-lambda';

interface PaymentEvent {
  orderId: string;
  amount: number;
  status: string;
}

export class PaymentProcessorLambda extends EventLambda<EventBridgeEvent<'payment.processed', PaymentEvent>> {
  protected async processEvent(event: EventBridgeEvent<'payment.processed', PaymentEvent>): Promise<void> {
    const paymentData = event.detail;
    await this.updateOrderStatus(paymentData);
  }
  
  private async updateOrderStatus(paymentData: PaymentEvent): Promise<void> {
    // Implementation to update order status
  }
}

export const handler = new PaymentProcessorLambda().handler.bind(new PaymentProcessorLambda());
```

## Best Practices

- Use strongly typed event interfaces for better type safety
- Process events in batches when possible for better efficiency
- Implement proper error handling for different event sources
- Use the `getEventSource` method to apply different processing logic based on the event source