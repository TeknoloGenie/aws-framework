# Error Handler Middleware

The `errorHandler` middleware provides standardized error handling for Lambda functions with HTTP API responses.

## Overview

This middleware catches errors thrown during Lambda execution and formats them into proper HTTP responses. It includes a hierarchy of error classes for different HTTP status codes, making it easy to throw appropriate errors from your business logic.

## Function Definition

```typescript
export const errorHandler = (): middy.MiddlewareObject<APIGatewayProxyEvent, APIGatewayProxyResult>
```

## Error Classes

### Base Error Class

```typescript
export class HttpError extends Error {
  constructor(public statusCode: number, message: string)
}
```

### Specific HTTP Error Classes

- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ConflictError` (409)
- `InternalServerError` (500)

## Features

- **Standardized Error Responses**: Consistent error format for all API responses
- **HTTP Status Code Mapping**: Automatically maps errors to appropriate HTTP status codes
- **CORS Headers**: Includes CORS headers in error responses
- **Error Logging**: Logs all errors for debugging

## Usage Example

```typescript
import middy from 'middy';
import { errorHandler, NotFoundError, BadRequestError } from 'aws-framework';

const baseHandler = async (event, context) => {
  const userId = event.pathParameters?.userId;
  
  if (!userId) {
    throw new BadRequestError('Missing userId parameter');
  }
  
  const user = await getUserById(userId);
  
  if (!user) {
    throw new NotFoundError(`User with ID ${userId} not found`);
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify(user)
  };
};

// Apply the error handler middleware
export const handler = middy(baseHandler)
  .use(errorHandler());
```

## Error Response Format

```json
{
  "error": "User with ID 123 not found"
}
```

## Error Handling Flow

1. Your Lambda function throws an error (either a standard Error or one of the HTTP error classes)
2. The middleware catches the error in its `onError` handler
3. If the error is an instance of `HttpError`, it uses the provided status code and message
4. If the error is a standard Error, it uses a 500 status code and the error message
5. The middleware formats a proper HTTP response with the error details
6. The response is returned to the client

## Best Practices

- Use the specific error classes to provide accurate HTTP status codes
- Include meaningful error messages that are safe to expose to clients
- Avoid exposing sensitive information in error messages
- Use the error handler middleware in combination with the logger middleware for comprehensive error tracking
- Consider extending the error classes for domain-specific errors