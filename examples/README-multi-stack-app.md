# Multi-Stack Application Example

This example demonstrates how to create an application that extends multiple AWS CDK stacks (AuthStack, DatabaseStack, MonitoringStack, and NetworkingStack).

## What it creates

- **VPC** with public/private/isolated subnets
- **Cognito User Pool** with authentication
- **DynamoDB tables** with GSIs and TTL
- **Lambda functions** running in VPC
- **API Gateway** with Cognito authorization
- **CloudWatch monitoring** with alarms and dashboard

## Usage

```bash
npx cdk deploy MyApp-Dev
```

## Architecture

The ApplicationStack orchestrates all components:
- Lambda functions run in private subnets
- API Gateway uses Cognito for auth
- DynamoDB stores user and application data
- CloudWatch monitors performance

## Outputs

- API Gateway URL
- Cognito User Pool ID
- VPC ID
- CloudWatch Dashboard