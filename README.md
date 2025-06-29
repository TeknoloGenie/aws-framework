# AWS Framework

A comprehensive AWS framework for Lambda functions and CDK stacks, providing reusable components for building secure, scalable serverless applications with built-in file handling, authentication, and web application support.

## Features

- **Lambda Base Classes**
  - REST API Lambda with built-in error handling
  - HTTP API Lambda with middleware support
  - Event-driven Lambda (SQS, SNS, EventBridge)
  - WebSocket API Lambda with connection management
  - S3 Event Lambda with file processing
  - DynamoDB Stream Lambda with change tracking

- **CDK Stack Components**
  - **Networking Stack** - VPC with public/private subnets
  - **API Gateway Stack** - REST/HTTP APIs with CORS support
  - **Serverless Stack** - Lambda functions with environment configs
  - **Monitoring Stack** - CloudWatch dashboards and alarms
  - **Database Stack** - DynamoDB with GSI support and backup
  - **Storage Stack** - S3 buckets with encryption and lifecycle policies
  - **Auth Stack** - Cognito User Pools with JWT validation
  - **File Stack** - Secure file upload/download with presigned URLs
  - **Web Stack** - CloudFront distribution with S3 origin
  - **Application Stack** - Complete web application orchestration

- **File Handling System**
  - Secure file upload with size and type validation
  - Private file sharing with time-limited access
  - Presigned URL generation for direct S3 access
  - File download with authentication checks
  - Support for multiple file formats and MIME types

- **Authentication & Security**
  - JWT token validation with AWS Cognito
  - Role-based access control (RBAC)
  - Private API endpoints with VPC isolation
  - S3 server-side encryption (AES-256)
  - Input validation and sanitization
  - CORS configuration for web applications

- **Middleware & Utilities**
  - Comprehensive error handling with structured responses
  - Structured logging with correlation IDs
  - AWS Secrets Manager integration
  - Parameter Store utilities
  - Authentication/Authorization middleware
  - Request validation with JSON schema
  - DynamoDB utilities with pagination support

- **Testing Framework**
  - Lambda test helpers with mock contexts
  - Mock event generators for all AWS services
  - Integration test utilities

- **CI/CD Templates**
  - GitHub Actions deployment workflows
  - Multi-environment deployment support
  - Automated testing and security scanning

## Installation

```bash
npm install aws-framework
```

## Usage

### Lambda Functions

```typescript
import { RestApiLambda, ApiResponse } from 'aws-framework';
import { APIGatewayProxyEvent } from 'aws-lambda';

export class HelloWorldLambda extends RestApiLambda {
  protected async processApi(event: APIGatewayProxyEvent): Promise<ApiResponse> {
    const name = this.getQueryParameter(event, 'name') || 'World';
    
    return {
      statusCode: 200,
      body: {
        message: `Hello, ${name}!`
      }
    };
  }
}

// Lambda handler
export const handler = new HelloWorldLambda().handler.bind(new HelloWorldLambda());
```

### CDK Stacks

```typescript
import * as cdk from 'aws-cdk-lib';
import { NetworkingStack, ApiGatewayStack, ServerlessStack } from 'aws-framework';

const app = new cdk.App();

// Create networking stack
const networkingStack = new NetworkingStack(app, 'NetworkingStack', {
  cidr: '10.0.0.0/16',
  maxAzs: 2
});

// Create API Gateway stack
const apiStack = new ApiGatewayStack(app, 'ApiStack', {
  apiName: 'MyApi',
  cors: true
});

// Create serverless stack with Lambda functions
const serverlessStack = new ServerlessStack(app, 'ServerlessStack');

// Create a Lambda function
const helloFunction = serverlessStack.createNodejsFunction(
  'HelloFunction',
  './src/handlers/hello',
  'handler',
  {
    environment: {
      STAGE: 'dev'
    }
  }
);

// Add Lambda integration to API Gateway
apiStack.addLambdaIntegration(
  '/hello',
  'GET',
  helloFunction
);
```

### File Handling System

```typescript
import { FileStack, FileUploadLambda, FileDownloadLambda } from 'aws-framework';

// Create file handling stack
const fileStack = new FileStack(app, 'FileStack', {
  bucketName: 'my-secure-files',
  enableVersioning: true,
  enableEncryption: true
});

// File upload handler
export class MyFileUploadLambda extends FileUploadLambda {
  protected async validateFile(fileName: string, contentType: string): Promise<boolean> {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    return allowedTypes.includes(contentType);
  }
}

// File download handler with authentication
export class MyFileDownloadLambda extends FileDownloadLambda {
  protected async authorizeDownload(userId: string, fileKey: string): Promise<boolean> {
    // Implement your authorization logic
    return await this.checkUserFileAccess(userId, fileKey);
  }
}
```

### Complete Web Application

```typescript
import { ApplicationStack } from 'aws-framework';

// Deploy a complete web application with authentication, file handling, and APIs
const webApp = new ApplicationStack(app, 'WebApp', {
  domainName: 'myapp.example.com',
  certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
  enableAuth: true,
  enableFileHandling: true,
  apiCorsOrigins: ['https://myapp.example.com']
});
```

## AWS SDK Version

This framework uses AWS SDK v3, which provides several advantages over v2:

- Modular architecture for smaller bundle sizes
- Improved TypeScript support
- Middleware-based request processing
- Automatic retries with exponential backoff
- Improved performance

## 🚨 Production Readiness

This framework provides a solid foundation for serverless applications, but additional security and operational measures are required before production deployment.

### ⚠️ Still Need Attention:

1. **API Rate Limiting** - Add throttling to prevent abuse
2. **WAF Integration** - Add Web Application Firewall
3. **Secrets Management** - Use AWS Secrets Manager for sensitive config
4. **Monitoring/Alerting** - CloudWatch alarms for security events
5. **Content Scanning** - Malware/virus scanning for uploads
6. **CORS Configuration** - Restrict origins in production
7. **Certificate Management** - Proper SSL/TLS configuration

### 🔒 Production Checklist:

- [ ] Update CORS origins to specific domains (not "*")
- [ ] Implement proper JWT validation in all endpoints
- [ ] Add API Gateway usage plans and API keys
- [ ] Enable AWS CloudTrail for audit logging
- [ ] Set up CloudWatch alarms for failed authentications
- [ ] Implement backup strategies for S3 buckets
- [ ] Add resource tagging for cost allocation and security
- [ ] Review and minimize IAM permissions
- [ ] Enable GuardDuty for threat detection
- [ ] Implement proper error handling without information leakage

### 📋 Security Recommendations:

- Review the [SECURITY.md](./SECURITY.md) file for detailed security guidelines
- Enable AWS Config for compliance monitoring
- Implement AWS Security Hub for centralized security findings
- Set up VPC Flow Logs for network monitoring
- Establish backup and disaster recovery procedures
- Regular security audits and penetration testing

### 🔧 Operational Requirements:

- Set up proper monitoring and alerting
- Implement log aggregation and analysis
- Configure automated backups
- Establish incident response procedures
- Document runbooks for common operations

## Documentation

For detailed documentation, see the [docs](./docs) directory.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.