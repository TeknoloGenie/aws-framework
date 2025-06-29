# AWS Framework Examples

This directory contains practical examples demonstrating how to use the AWS CDK framework components.

## Examples

### [Multi-Stack Application](README-multi-stack-app.md)
Complete application extending AuthStack, DatabaseStack, MonitoringStack, and NetworkingStack.
- **File**: `multi-stack-app.ts`
- **Features**: VPC, Cognito, DynamoDB, Lambda, API Gateway, CloudWatch

### [Database with APIs](README-database-with-apis.md)
DynamoDB tables with automatic REST and WebSocket API generation.
- **File**: `database-with-apis.ts`
- **Features**: Auto-generated CRUD APIs, WebSocket real-time updates

### [WebSocket Frontend](README-websocket-frontend.md)
Frontend examples for connecting to WebSocket APIs.
- **Files**: `websocket-frontend.html`, `websocket-frontend.js`
- **Features**: HTML client, JavaScript class, React hook

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Deploy an example:
```bash
npx cdk deploy --app "npx ts-node examples/multi-stack-app.ts"
```

3. Clean up:
```bash
npx cdk destroy --app "npx ts-node examples/multi-stack-app.ts"
```