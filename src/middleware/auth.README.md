# Authentication Middleware

The authentication middleware provides JWT validation and role-based access control for Lambda functions using Amazon Cognito.

## Overview

This middleware package includes two main components:
1. `jwtAuth`: Validates JWT tokens from Amazon Cognito
2. `roleAuth`: Enforces role-based access control based on user claims

## JWT Authentication

### Function Definition

```typescript
export const jwtAuth = (options: JwtAuthOptions): middy.MiddlewareObject<APIGatewayProxyEvent, APIGatewayProxyResult>
```

### JwtAuthOptions Interface

```typescript
export interface JwtAuthOptions {
  userPoolId: string;                                                // Cognito User Pool ID
  clientId: string;                                                  // Cognito App Client ID
  tokenUse?: 'access' | 'id';                                        // Default: 'access'
  extractToken?: (event: APIGatewayProxyEvent) => string | undefined; // Default: extract from Authorization header
}
```

### Features

- **JWT Validation**: Verifies tokens issued by Amazon Cognito
- **Token Extraction**: Extracts tokens from the Authorization header by default
- **User Context**: Adds the decoded token claims to the request context
- **Error Handling**: Throws standardized UnauthorizedError for invalid tokens

## Role-Based Authorization

### Function Definition

```typescript
export const roleAuth = (options: RoleAuthOptions): middy.MiddlewareObject<APIGatewayProxyEvent, APIGatewayProxyResult>
```

### RoleAuthOptions Interface

```typescript
export interface RoleAuthOptions {
  allowedRoles: string[];  // List of roles that are allowed to access the resource
  rolesPath?: string;      // Path to the roles in the JWT claims (default: 'cognito:groups')
}
```

### Features

- **Role Verification**: Checks if the user has at least one of the allowed roles
- **Flexible Role Path**: Configurable path to extract roles from JWT claims
- **Error Handling**: Throws standardized UnauthorizedError for insufficient permissions

## Dependencies

This middleware requires the following npm package:

- `aws-jwt-verify`

## Usage Example

### JWT Authentication

```typescript
import middy from 'middy';
import { jwtAuth, errorHandler } from 'aws-framework';

const baseHandler = async (event, context) => {
  // The user claims are available in context.user
  const userId = context.user.sub;
  const username = context.user.username;
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello, ${username}!`,
      userId
    })
  };
};

// Apply the JWT authentication middleware
export const handler = middy(baseHandler)
  .use(jwtAuth({
    userPoolId: 'us-east-1_abcdefghi',
    clientId: '1234567890abcdefghijklmnop',
    tokenUse: 'access'
  }))
  .use(errorHandler());
```

### Role-Based Authorization

```typescript
import middy from 'middy';
import { jwtAuth, roleAuth, errorHandler } from 'aws-framework';

const baseHandler = async (event, context) => {
  // Only users with 'admin' or 'editor' roles will reach this code
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'You have access to this resource'
    })
  };
};

// Apply both JWT authentication and role-based authorization
export const handler = middy(baseHandler)
  .use(jwtAuth({
    userPoolId: 'us-east-1_abcdefghi',
    clientId: '1234567890abcdefghijklmnop'
  }))
  .use(roleAuth({
    allowedRoles: ['admin', 'editor']
  }))
  .use(errorHandler());
```

### Custom Token Extraction

```typescript
import middy from 'middy';
import { jwtAuth, errorHandler } from 'aws-framework';

// Extract token from a custom header
const extractTokenFromCustomHeader = (event) => {
  return event.headers?.['x-custom-auth'];
};

export const handler = middy(baseHandler)
  .use(jwtAuth({
    userPoolId: 'us-east-1_abcdefghi',
    clientId: '1234567890abcdefghijklmnop',
    extractToken: extractTokenFromCustomHeader
  }))
  .use(errorHandler());
```

## Best Practices

- Always use HTTPS for endpoints that require authentication
- Use the `errorHandler` middleware to properly format authentication errors
- Consider using the `logger` middleware to log authentication failures
- Use access tokens for API authorization and ID tokens for user identity
- Implement the principle of least privilege by restricting roles to the minimum required
- Use environment variables for User Pool ID and Client ID to support different environments