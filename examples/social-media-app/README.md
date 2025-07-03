# Social Media Application

A complete social media application built with AWS Framework, featuring posts, comments, real-time chat, and role-based access control.

## Features

- **User Management**: Registration, authentication, and profiles with AWS Cognito
- **Posts & Feeds**: Create, read, update posts with media support
- **Comments**: Nested commenting system on posts with real-time updates
- **Real-time Chat**: Group and individual messaging with WebSockets
- **Role-based Access**: Admin, moderator, and user roles with granular permissions
- **File Handling**: Secure image/video uploads for posts and profiles
- **Real-time Updates**: Live feed updates via WebSocket connections
- **Responsive Design**: Mobile-first Next.js frontend

## Architecture

### Backend (AWS)
- **API Gateway**: REST APIs for CRUD operations with Cognito authentication
- **WebSocket API**: Real-time messaging and notifications
- **Lambda Functions**: Business logic handlers using AWS Framework base classes
- **DynamoDB**: Single-table design for users, posts, comments, messages, and chats
- **S3**: Secure media file storage with presigned URLs
- **Cognito**: User authentication and management
- **CloudFront**: CDN for media delivery and frontend hosting

### Frontend (Next.js)
- **Static Site Generation**: SEO-optimized pages with Next.js
- **Real-time UI**: WebSocket integration for live updates
- **Responsive Design**: Tailwind CSS with mobile-first approach
- **Authentication**: AWS Amplify Auth integration
- **State Management**: React Query for server state
- **File Uploads**: Drag-and-drop media uploads with progress

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- AWS CLI configured with appropriate permissions
- AWS CDK CLI installed globally

### 1. Clone and Setup
```bash
git clone <repository-url>
cd social-media-app
```

### 2. Deploy Backend
```bash
cd backend
npm install
npm run deploy:dev
```

### 3. Deploy Frontend
```bash
cd ../frontend
npm install

# Copy environment variables from backend deployment
cp .env.example .env.local
# Update .env.local with your deployed backend URLs

npm run build
npm run deploy
```

### 4. One-Command Deployment
```bash
# Deploy everything with the deployment script
./deployment/deploy.sh dev
```

## Environment Configuration

### Backend Environment Variables
Set these in your CDK context or environment:
- `STAGE`: Deployment stage (dev, staging, prod)
- `AWS_REGION`: AWS region for deployment
- `DOMAIN_NAME`: Custom domain name (optional)
- `CERTIFICATE_ARN`: SSL certificate ARN (optional)

### Frontend Environment Variables
Create `.env.local` in the frontend directory:
```env
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_S3_BUCKET=social-media-files-dev
NEXT_PUBLIC_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_WEBSOCKET_URL=wss://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/dev
```

## API Endpoints

### Authentication
All API endpoints require JWT authentication via Cognito User Pool.

### Posts API
- `GET /posts` - Get feed posts with pagination
- `GET /posts/{id}` - Get specific post
- `POST /posts` - Create new post
- `PUT /posts/{id}` - Update post (owner or admin)
- `DELETE /posts/{id}` - Delete post (owner or admin)
- `POST /posts/{id}/like` - Like/unlike post

### Comments API
- `GET /posts/{postId}/comments` - Get post comments with nested replies
- `POST /posts/{postId}/comments` - Add comment or reply
- `PUT /comments/{id}` - Update comment (owner or admin)
- `DELETE /comments/{id}` - Delete comment (owner or admin)
- `POST /comments/{id}/like` - Like/unlike comment

### Chat API
- `GET /chats` - Get user's chats
- `GET /chats/{id}` - Get specific chat details
- `POST /chats` - Create new chat (direct or group)
- `PUT /chats/{id}` - Update chat settings (admin only)
- `DELETE /chats/{id}` - Delete chat (admin only)

### Messages API
- `GET /chats/{chatId}/messages` - Get chat messages with pagination
- `POST /chats/{chatId}/messages` - Send message
- `PUT /messages/{id}` - Update message (owner only)
- `DELETE /messages/{id}` - Delete message (owner or admin)
- `POST /messages/{id}/read` - Mark message as read

### File Upload API
- `POST /upload` - Get presigned URL for file upload

## WebSocket Events

### Real-time Events
- `post.created` - New post notification
- `post.updated` - Post update notification
- `post.deleted` - Post deletion notification
- `comment.added` - New comment notification
- `comment.updated` - Comment update notification
- `comment.deleted` - Comment deletion notification
- `message.sent` - New chat message
- `message.read` - Message read receipt
- `user.typing` - Typing indicator
- `user.online` - User online status
- `user.offline` - User offline status

## Role-Based Access Control

### User Roles
- **User**: Basic permissions for creating posts, comments, and messages
- **Moderator**: Can moderate content, delete any posts/comments
- **Admin**: Full access to all features and user management

### Permissions System
The application uses a granular permission system defined in `backend/src/utils/permissions.ts`:
- Post permissions: create, update own/any, delete own/any
- Comment permissions: create, update own/any, delete own/any
- Chat permissions: create, join, send messages, delete own/any messages
- Admin permissions: manage users, moderate content, view analytics

## Database Schema

### DynamoDB Single Table Design
The application uses a single DynamoDB table with the following access patterns:

#### Primary Key Structure
- **PK (Partition Key)**: Entity identifier
- **SK (Sort Key)**: Entity type and identifier
- **GSI1PK/GSI1SK**: User-based queries
- **GSI2PK/GSI2SK**: Time-based queries

#### Entity Types
- **USER**: User profiles and settings
- **POST**: User posts with metadata
- **COMMENT**: Comments and replies on posts
- **CHAT**: Chat room information
- **MESSAGE**: Chat messages
- **CONNECTION**: WebSocket connection tracking

## Security Features

### Authentication & Authorization
- JWT token validation with AWS Cognito
- Role-based access control (RBAC)
- API Gateway authorizers for all endpoints

### Data Security
- S3 server-side encryption (AES-256)
- Presigned URLs for secure file uploads
- Input validation and sanitization
- SQL injection prevention with DynamoDB

### Network Security
- CORS configuration for web applications
- VPC isolation for Lambda functions (optional)
- CloudFront for CDN and DDoS protection

## Monitoring & Observability

### CloudWatch Integration
- Lambda function metrics and logs
- DynamoDB performance metrics
- API Gateway request/response metrics
- Custom business metrics

### Alarms & Notifications
- Error rate monitoring
- Performance threshold alerts
- Security event notifications

## Development

### Local Development
```bash
# Backend
cd backend
npm run watch  # TypeScript compilation in watch mode
npm test       # Run unit tests

# Frontend
cd frontend
npm run dev    # Start development server
npm run lint   # Run ESLint
```

### Testing
```bash
# Backend unit tests
cd backend
npm test

# Frontend testing
cd frontend
npm test
```

## Production Deployment

### Production Checklist
- [ ] Update CORS origins to specific domains
- [ ] Enable CloudTrail for audit logging
- [ ] Set up CloudWatch alarms
- [ ] Configure backup strategies
- [ ] Review IAM permissions
- [ ] Enable GuardDuty for threat detection
- [ ] Set up WAF rules
- [ ] Configure custom domain with SSL

### Deployment Commands
```bash
# Production deployment
./deployment/deploy.sh prod

# With custom domain
DOMAIN_NAME=myapp.com CERTIFICATE_ARN=arn:aws:acm:... ./deployment/deploy.sh prod
```

## Cost Optimization

### AWS Services Pricing
- **Lambda**: Pay per request and execution time
- **DynamoDB**: On-demand billing for variable workloads
- **S3**: Standard storage with lifecycle policies
- **API Gateway**: Pay per API call
- **Cognito**: Free tier for up to 50,000 MAUs

### Cost Optimization Tips
- Use DynamoDB on-demand for unpredictable traffic
- Implement S3 lifecycle policies for old media
- Enable Lambda provisioned concurrency only for production
- Use CloudFront caching to reduce API calls

## Troubleshooting

### Common Issues
1. **WebSocket Connection Fails**: Check CORS settings and authentication
2. **File Upload Errors**: Verify S3 bucket permissions and CORS
3. **Authentication Issues**: Check Cognito User Pool configuration
4. **API Errors**: Review CloudWatch logs for Lambda functions

### Debug Commands
```bash
# View CloudFormation stack
aws cloudformation describe-stacks --stack-name SocialMediaApp

# Check Lambda logs
aws logs tail /aws/lambda/SocialMediaApp-PostsFunction --follow

# Test API endpoints
curl -H "Authorization: Bearer $JWT_TOKEN" $API_ENDPOINT/posts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
