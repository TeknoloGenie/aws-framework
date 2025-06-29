# Database with Automatic APIs Example

This example shows how to create DynamoDB tables that automatically generate REST and WebSocket APIs.

## What it creates

- **Users table** with REST API endpoints
- **ChatMessages table** with WebSocket API for real-time messaging
- **Notifications table** with both REST and WebSocket APIs
- **Analytics table** without APIs (traditional approach)

## Generated APIs

### REST Endpoints
- `POST /users` - Create user
- `GET /users` - List users
- `GET /users/{id}` - Get user
- `PUT /users/{id}` - Update user
- `DELETE /users/{id}` - Delete user

### WebSocket Routes
- `create` - Real-time creation events
- `update` - Real-time update events
- `delete` - Real-time deletion events

## Usage

```bash
npx cdk deploy MyApiStack MyDatabaseStack
```

## Configuration Options

```typescript
apiConfig: {
  enableRestApi: true,        // Generate REST endpoints
  enableWebSocket: true,      // Generate WebSocket API
  apiGatewayStack: apiStack,  // Connect to existing API Gateway
  websocketApiName: 'MyAPI',  // Custom WebSocket API name
}
```