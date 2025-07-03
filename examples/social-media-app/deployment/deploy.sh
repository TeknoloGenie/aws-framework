#!/bin/bash

# Social Media App Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
STAGE=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
DOMAIN_NAME=${DOMAIN_NAME:-""}
CERTIFICATE_ARN=${CERTIFICATE_ARN:-""}

echo -e "${GREEN}🚀 Deploying Social Media App - Stage: $STAGE${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ AWS CDK is not installed. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Deployment Configuration:${NC}"
echo "  Stage: $STAGE"
echo "  Region: $AWS_REGION"
echo "  Domain: ${DOMAIN_NAME:-'Not configured'}"
echo "  Certificate: ${CERTIFICATE_ARN:-'Not configured'}"
echo ""

# Deploy Backend
echo -e "${GREEN}🏗️  Deploying Backend Infrastructure...${NC}"
cd backend

# Install dependencies
echo "Installing backend dependencies..."
npm install

# Bootstrap CDK (if needed)
echo "Bootstrapping CDK..."
cdk bootstrap --context stage=$STAGE

# Deploy infrastructure
echo "Deploying CDK stack..."
if [ -n "$DOMAIN_NAME" ] && [ -n "$CERTIFICATE_ARN" ]; then
    cdk deploy --context stage=$STAGE --context domainName=$DOMAIN_NAME --context certificateArn=$CERTIFICATE_ARN --require-approval never
else
    cdk deploy --context stage=$STAGE --require-approval never
fi

# Get stack outputs
echo "Getting stack outputs..."
STACK_NAME="SocialMediaApp"
API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text --region $AWS_REGION)
WEBSOCKET_ENDPOINT=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`WebSocketEndpoint`].OutputValue' --output text --region $AWS_REGION)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text --region $AWS_REGION)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text --region $AWS_REGION)
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' --output text --region $AWS_REGION)

echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
echo "  API Endpoint: $API_ENDPOINT"
echo "  WebSocket Endpoint: $WEBSOCKET_ENDPOINT"
echo "  User Pool ID: $USER_POOL_ID"
echo "  S3 Bucket: $S3_BUCKET"
echo ""

# Deploy Frontend
echo -e "${GREEN}🎨 Deploying Frontend...${NC}"
cd ../frontend

# Install dependencies
echo "Installing frontend dependencies..."
npm install

# Create environment file
echo "Creating environment configuration..."
cat > .env.local << EOF
NEXT_PUBLIC_AWS_REGION=$AWS_REGION
NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
NEXT_PUBLIC_S3_BUCKET=$S3_BUCKET
NEXT_PUBLIC_API_URL=$API_ENDPOINT
NEXT_PUBLIC_WEBSOCKET_URL=$WEBSOCKET_ENDPOINT
EOF

# Build frontend
echo "Building frontend..."
npm run build

# Deploy to S3 (if using static hosting)
if [ -n "$S3_BUCKET" ]; then
    echo "Deploying to S3..."
    
    # Create S3 bucket for frontend (if it doesn't exist)
    FRONTEND_BUCKET="social-media-frontend-$STAGE"
    
    if ! aws s3 ls "s3://$FRONTEND_BUCKET" 2>&1 | grep -q 'NoSuchBucket'; then
        echo "Creating S3 bucket for frontend..."
        aws s3 mb s3://$FRONTEND_BUCKET --region $AWS_REGION
        
        # Configure bucket for static website hosting
        aws s3 website s3://$FRONTEND_BUCKET --index-document index.html --error-document error.html
        
        # Set bucket policy for public read access
        cat > bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$FRONTEND_BUCKET/*"
        }
    ]
}
EOF
        aws s3api put-bucket-policy --bucket $FRONTEND_BUCKET --policy file://bucket-policy.json
        rm bucket-policy.json
    fi
    
    # Sync build files to S3
    aws s3 sync out/ s3://$FRONTEND_BUCKET --delete
    
    FRONTEND_URL="http://$FRONTEND_BUCKET.s3-website-$AWS_REGION.amazonaws.com"
    echo -e "${GREEN}✅ Frontend deployed to: $FRONTEND_URL${NC}"
fi

cd ..

# Create deployment summary
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Deployment Summary:${NC}"
echo "  Stage: $STAGE"
echo "  Region: $AWS_REGION"
echo "  API Endpoint: $API_ENDPOINT"
echo "  WebSocket Endpoint: $WEBSOCKET_ENDPOINT"
echo "  User Pool ID: $USER_POOL_ID"
echo "  S3 Bucket: $S3_BUCKET"
if [ -n "$FRONTEND_URL" ]; then
    echo "  Frontend URL: $FRONTEND_URL"
fi
if [ -n "$DOMAIN_NAME" ]; then
    echo "  Custom Domain: https://$DOMAIN_NAME"
fi
echo ""

# Save deployment info
cat > deployment-info.json << EOF
{
  "stage": "$STAGE",
  "region": "$AWS_REGION",
  "apiEndpoint": "$API_ENDPOINT",
  "websocketEndpoint": "$WEBSOCKET_ENDPOINT",
  "userPoolId": "$USER_POOL_ID",
  "userPoolClientId": "$USER_POOL_CLIENT_ID",
  "s3Bucket": "$S3_BUCKET",
  "frontendUrl": "${FRONTEND_URL:-''}",
  "customDomain": "${DOMAIN_NAME:-''}",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo -e "${GREEN}💾 Deployment info saved to deployment-info.json${NC}"
echo ""

# Post-deployment instructions
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Update your frontend environment variables if needed"
echo "2. Test the application functionality"
echo "3. Set up monitoring and alerts"
echo "4. Configure custom domain (if not done already)"
echo "5. Set up CI/CD pipeline for automated deployments"
echo ""

if [ "$STAGE" = "prod" ]; then
    echo -e "${YELLOW}⚠️  Production Deployment Checklist:${NC}"
    echo "□ Review security settings"
    echo "□ Enable CloudTrail logging"
    echo "□ Set up backup strategies"
    echo "□ Configure monitoring and alerting"
    echo "□ Test disaster recovery procedures"
    echo "□ Review IAM permissions"
    echo "□ Enable GuardDuty"
    echo "□ Set up WAF rules"
    echo ""
fi

echo -e "${GREEN}🎊 Happy coding!${NC}"
