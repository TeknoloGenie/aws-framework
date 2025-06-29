# WebSocketLambda

The `WebSocketLambda` class extends the base Lambda functionality to handle WebSocket connections through API Gateway.

## Overview

This class provides a structured approach to building Lambda functions that handle WebSocket connections. It includes utilities for managing connections, processing WebSocket events, and sending messages to connected clients.

## Class Definition

```typescript
export abstract class WebSocketLambda extends BaseLambda<APIGatewayProxyEvent, APIGatewayProxyResult>
```

## Key Methods

### `processWebSocket(event: APIGatewayProxyEvent): Promise<WebSocketResponse>`

Abstract method that must be implemented by subclasses to define the WebSocket processing logic. Returns a `WebSocketResponse` object.

### `process(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>`

Implements the abstract `process` method from `BaseLambda`. Calls `processWebSocket` and formats the response.

### `handleError(error: Error | unknown): Promise<APIGatewayProxyResult>`

Implements the abstract `handleError` method from `BaseLambda`. Returns a standardized 500 error response.

### Utility Methods

- `getConnectionId(event: APIGatewayProxyEvent): string | undefined`
  Extracts the WebSocket connection ID from the event.

- `getRouteKey(event: APIGatewayProxyEvent): string | undefined`
  Extracts the WebSocket route key from the event.

- `sendMessage(connectionId: string, data: any): Promise<void>`
  Sends a message to a connected WebSocket client.

## WebSocketResponse Interface

```typescript
export interface WebSocketResponse {
  statusCode: number;
  body?: any;
}
```

## Usage Example

```typescript
import { WebSocketLambda, WebSocketResponse } from 'aws-framework';
import { APIGatewayProxyEvent } from 'aws-lambda';

export class ChatLambda extends WebSocketLambda {
  protected async processWebSocket(event: APIGatewayProxyEvent): Promise<WebSocketResponse> {
    const connectionId = this.getConnectionId(event);
    const routeKey = this.getRouteKey(event);
    
    if (!connectionId) {
      return {
        statusCode: 400,
        body: { message: 'Missing connection ID' }
      };
    }
    
    switch (routeKey) {
      case '$connect':
        await this.handleConnect(connectionId);
        break;
      case '$disconnect':
        await this.handleDisconnect(connectionId);
        break;
      case 'sendMessage':
        await this.handleSendMessage(event, connectionId);
        break;
      default:
        return {
          statusCode: 400,
          body: { message: 'Unknown route key' }
        };
    }
    
    return {
      statusCode: 200
    };
  }
  
  private async handleConnect(connectionId: string): Promise<void> {
    // Store connection ID in database
  }
  
  private async handleDisconnect(connectionId: string): Promise<void> {
    // Remove connection ID from database
  }
  
  private async handleSendMessage(event: APIGatewayProxyEvent, connectionId: string): Promise<void> {
    const body = JSON.parse(event.body || '{}');
    const message = body.message;
    
    // Broadcast message to all connections
    const connections = await this.getAllConnections();
    
    for (const targetConnectionId of connections) {
      try {
        await this.sendMessage(targetConnectionId, {
          from: connectionId,
          message
        });
      } catch (error) {
        // Handle connection errors
      }
    }
  }
  
  private async getAllConnections(): Promise<string[]> {
    // Retrieve all connection IDs from database
    return [];
  }
}

export const handler = new ChatLambda().handler.bind(new ChatLambda());
```

## Best Practices

- Store connection IDs in a database (DynamoDB) for persistence
- Handle the standard WebSocket route keys: $connect, $disconnect, and custom routes
- Implement proper error handling for connection issues
- Use the `sendMessage` method to communicate with connected clients
- Clean up connection resources when clients disconnect
- Use the AWS SDK v3's modular approach for better tree-shaking and smaller bundle sizes
- Note that the Data parameter in PostToConnectionCommand now requires a Buffer instead of a string