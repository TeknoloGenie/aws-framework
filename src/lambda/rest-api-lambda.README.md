# RestApiLambda

The `RestApiLambda` class extends the base Lambda functionality to handle API Gateway REST API events.

## Overview

This class provides a structured approach to building Lambda functions that respond to API Gateway REST API events. It includes utilities for handling request parameters, parsing request bodies, and formatting API responses.

## Class Definition

```typescript
export abstract class RestApiLambda extends BaseLambda<APIGatewayProxyEvent, APIGatewayProxyResult>
```

## Key Methods

### `processApi(event: APIGatewayProxyEvent): Promise<ApiResponse>`

Abstract method that must be implemented by subclasses to define the API processing logic. Returns an `ApiResponse` object.

### `process(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>`

Implements the abstract `process` method from `BaseLambda`. Calls `processApi` and formats the response with appropriate headers.

### `handleError(error: Error | unknown): Promise<APIGatewayProxyResult>`

Implements the abstract `handleError` method from `BaseLambda`. Returns a standardized 500 error response.

### Utility Methods

- `getPathParameter(event: APIGatewayProxyEvent, name: string): string | undefined`
  Extracts a path parameter from the event.

- `getQueryParameter(event: APIGatewayProxyEvent, name: string): string | undefined`
  Extracts a query string parameter from the event.

- `getBody<T>(event: APIGatewayProxyEvent): T | undefined`
  Parses and returns the request body as the specified type.

## ApiResponse Interface

```typescript
export interface ApiResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}
```

## Usage Example

```typescript
import { RestApiLambda, ApiResponse } from 'aws-framework';
import { APIGatewayProxyEvent } from 'aws-lambda';

export class UserLambda extends RestApiLambda {
  protected async processApi(event: APIGatewayProxyEvent): Promise<ApiResponse> {
    const userId = this.getPathParameter(event, 'userId');
    
    if (!userId) {
      return {
        statusCode: 400,
        body: { message: 'Missing userId parameter' }
      };
    }
    
    // Process the request
    const user = await this.getUserById(userId);
    
    return {
      statusCode: 200,
      body: user
    };
  }
  
  private async getUserById(userId: string): Promise<any> {
    // Implementation to fetch user
  }
}

export const handler = new UserLambda().handler.bind(new UserLambda());
```

## Best Practices

- Use the utility methods to extract parameters and parse the request body
- Return appropriate HTTP status codes for different scenarios
- Include relevant headers in the response when needed
- Implement proper error handling for different types of errors