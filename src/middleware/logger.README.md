# Logger Middleware

The `logger` middleware provides structured logging for Lambda functions with automatic redaction of sensitive information.

## Overview

This middleware enhances Lambda functions with consistent logging before execution, after successful completion, and when errors occur. It automatically redacts sensitive information and provides configurable logging levels.

## Function Definition

```typescript
export const logger = (options: LoggerOptions = {}): middy.MiddlewareObject<any, any>
```

### LoggerOptions Interface

```typescript
export interface LoggerOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';  // Default: 'info'
  logEvent?: boolean;                           // Default: true
  logContext?: boolean;                         // Default: false
  logResponse?: boolean;                        // Default: true
  sensitiveKeys?: string[];                     // Default: ['password', 'token', 'authorization', 'secret', 'credential']
}
```

## Features

- **Lifecycle Logging**: Logs at the beginning and end of Lambda execution
- **Error Logging**: Comprehensive error logging with stack traces
- **Sensitive Data Redaction**: Automatically redacts sensitive information
- **Configurable Log Levels**: Supports debug, info, warn, and error levels
- **Performance Metrics**: Logs execution time and remaining time

## Usage Example

```typescript
import middy from 'middy';
import { logger } from 'aws-framework';

const baseHandler = async (event, context) => {
  // Your Lambda logic here
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Success' })
  };
};

// Apply the logger middleware
export const handler = middy(baseHandler)
  .use(
    logger({
      level: 'debug',
      logEvent: true,
      logContext: true,
      logResponse: true,
      sensitiveKeys: ['password', 'token', 'apiKey']
    })
  );
```

## Log Output Examples

### Invocation Start

```
INFO: Lambda invocation started: my-function { requestId: '8d7f8e7d-1234-5678-9abc-def012345678', remainingTime: 899123 }
DEBUG: Event: { httpMethod: 'GET', path: '/users', ... }
```

### Successful Completion

```
DEBUG: Response: { statusCode: 200, body: '{"message":"Success"}' }
INFO: Lambda invocation completed: my-function { requestId: '8d7f8e7d-1234-5678-9abc-def012345678', executionTime: 123 }
```

### Error

```
ERROR: Lambda invocation failed: my-function {
  error: 'Error: Database connection failed',
  stack: 'Error: Database connection failed\n    at processRequest (/var/task/index.js:42:23)\n    ...',
  requestId: '8d7f8e7d-1234-5678-9abc-def012345678'
}
```

## Best Practices

- Use 'info' level for production and 'debug' for development
- Keep the default sensitive keys list and add any application-specific sensitive fields
- Enable `logContext` only when needed as it can increase log volume
- Use structured logging patterns for easier log parsing and analysis
- Consider adding custom fields to the log output for better context