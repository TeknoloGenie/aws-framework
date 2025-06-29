# HttpApiLambda

The `HttpApiLambda` class extends the base Lambda functionality to handle API Gateway HTTP API events (v2).

## Overview

This class provides a structured approach to building Lambda functions that respond to API Gateway HTTP API events. It supports the newer HTTP API format (APIGatewayProxyEventV2) which offers improved performance and additional features compared to the REST API format.

## Class Definition

```typescript
export abstract class HttpApiLambda extends BaseLambda<APIGatewayProxyEventV2, APIGatewayProxyResultV2>
```

## Key Methods

### `processHttpApi(event: APIGatewayProxyEventV2): Promise<HttpApiResponse>`

Abstract method that must be implemented by subclasses to define the HTTP API processing logic. Returns an `HttpApiResponse` object.

### `process(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2>`

Implements the abstract `process` method from `BaseLambda`. Calls `processHttpApi` and formats the response with appropriate headers.

### `handleError(error: Error | unknown): Promise<APIGatewayProxyResultV2>`

Implements the abstract `handleError` method from `BaseLambda`. Returns a standardized 500 error response.

### Utility Methods

- `getPathParameter(event: APIGatewayProxyEventV2, name: string): string | undefined`
  Extracts a path parameter from the event.

- `getQueryParameter(event: APIGatewayProxyEventV2, name: string): string | undefined`
  Extracts a query string parameter from the event.

- `getBody<T>(event: APIGatewayProxyEventV2): T | undefined`
  Parses and returns the request body as the specified type.

## HttpApiResponse Interface

```typescript
export interface HttpApiResponse {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
  cookies?: string[];
}
```

## Usage Example

```typescript
import { HttpApiLambda, HttpApiResponse } from 'aws-framework';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

export class ProductsLambda extends HttpApiLambda {
  protected async processHttpApi(event: APIGatewayProxyEventV2): Promise<HttpApiResponse> {
    const productId = this.getPathParameter(event, 'productId');
    
    if (!productId) {
      return {
        statusCode: 400,
        body: { message: 'Missing productId parameter' }
      };
    }
    
    // Process the request
    const product = await this.getProductById(productId);
    
    return {
      statusCode: 200,
      body: product,
      cookies: ['session=active; Secure; HttpOnly']
    };
  }
  
  private async getProductById(productId: string): Promise<any> {
    // Implementation to fetch product
  }
}

export const handler = new ProductsLambda().handler.bind(new ProductsLambda());
```

## Key Differences from RestApiLambda

- Uses the newer HTTP API format (APIGatewayProxyEventV2)
- Supports cookies in the response
- Simplified event structure
- Better performance and lower latency
- Lower cost compared to REST API

## Best Practices

- Use the utility methods to extract parameters and parse the request body
- Return appropriate HTTP status codes for different scenarios
- Use cookies for session management when appropriate
- Implement proper error handling for different types of errors