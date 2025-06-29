# Validator Middleware

The `validator` middleware provides JSON Schema validation for request and response payloads in Lambda functions.

## Overview

This middleware validates incoming request bodies against a JSON Schema before processing and can optionally validate outgoing responses. It uses the AJV (Another JSON Validator) library for fast and comprehensive validation.

## Function Definition

```typescript
export const validator = (options: ValidatorOptions): middy.MiddlewareObject<APIGatewayProxyEvent, APIGatewayProxyResult>
```

### ValidatorOptions Interface

```typescript
export interface ValidatorOptions {
  inputSchema?: any;    // JSON Schema for validating request bodies
  outputSchema?: any;   // JSON Schema for validating response bodies
  ajvOptions?: any;     // Options passed to AJV instance
}
```

## Features

- **Request Validation**: Validates incoming request bodies against a JSON Schema
- **Response Validation**: Optionally validates outgoing responses against a JSON Schema
- **Detailed Error Messages**: Provides detailed validation error messages
- **Type Coercion**: Automatically converts types based on the schema
- **Default Values**: Applies default values from the schema
- **Lazy Loading**: Only loads the AJV library when needed to reduce cold start time

## Dependencies

This middleware requires the following npm packages:

- `ajv`
- `ajv-formats`

## Usage Example

```typescript
import middy from 'middy';
import { validator, errorHandler } from 'aws-framework';

// Define JSON Schema for request validation
const inputSchema = {
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
    age: { type: 'number', minimum: 18 }
  },
  additionalProperties: false
};

// Define JSON Schema for response validation
const outputSchema = {
  type: 'object',
  required: ['id', 'name', 'email'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    email: { type: 'string' },
    age: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' }
  }
};

const baseHandler = async (event, context) => {
  // The event.body is already validated and parsed
  const userData = JSON.parse(event.body);
  
  // Process the data
  const user = await createUser(userData);
  
  return {
    statusCode: 201,
    body: JSON.stringify(user)
  };
};

// Apply the validator middleware
export const handler = middy(baseHandler)
  .use(validator({
    inputSchema,
    outputSchema,
    ajvOptions: {
      allErrors: true,
      coerceTypes: true,
      useDefaults: true
    }
  }))
  .use(errorHandler());
```

## Validation Error Response

When validation fails, the middleware throws a `BadRequestError` with details about the validation errors:

```json
{
  "error": "Validation error: [{\"field\":\"/email\",\"message\":\"must match format \\\"email\\\"\"}]"
}
```

## Best Practices

- Define comprehensive schemas for both input and output validation
- Use the `errorHandler` middleware in combination with the validator for proper error responses
- Consider using JSON Schema `$ref` for reusable schema components
- Use the `format` keyword for common formats like email, date-time, etc.
- Enable `useDefaults` to automatically apply default values from the schema
- Enable `coerceTypes` to automatically convert types based on the schema
- Use `additionalProperties: false` to prevent unexpected properties in requests