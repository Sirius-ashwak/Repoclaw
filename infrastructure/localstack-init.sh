#!/bin/bash

# LocalStack Initialization Script
# Sets up DynamoDB table, S3 bucket, and Lambda function for local development

set -e

ENDPOINT="http://localhost:4566"
REGION="ap-south-1"
TABLE_NAME="repoclaw-sessions"
BUCKET_NAME="repoclaw-artifacts"
FUNCTION_NAME="repoclaw-code-sandbox"

echo "========================================="
echo "Initializing LocalStack for RepoClaw"
echo "========================================="

# Wait for LocalStack to be ready
echo "Waiting for LocalStack to be ready..."
until curl -s ${ENDPOINT}/_localstack/health | grep -q '"dynamodb": "available"'; do
    echo "Waiting for DynamoDB..."
    sleep 2
done
echo "✓ LocalStack is ready"

# Create DynamoDB table
echo ""
echo "Creating DynamoDB table..."
aws dynamodb create-table \
    --table-name ${TABLE_NAME} \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=EntityType,AttributeType=S \
        AttributeName=CreatedAt,AttributeType=N \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        "IndexName=EntityType-CreatedAt-index,KeySchema=[{AttributeName=EntityType,KeyType=HASH},{AttributeName=CreatedAt,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url ${ENDPOINT} \
    --region ${REGION} \
    > /dev/null 2>&1 || echo "Table already exists"

echo "✓ DynamoDB table ready"

# Create S3 bucket
echo ""
echo "Creating S3 bucket..."
aws s3 mb s3://${BUCKET_NAME} \
    --endpoint-url ${ENDPOINT} \
    --region ${REGION} \
    > /dev/null 2>&1 || echo "Bucket already exists"

# Configure CORS for S3 bucket
aws s3api put-bucket-cors \
    --bucket ${BUCKET_NAME} \
    --cors-configuration '{
        "CORSRules": [{
            "AllowedOrigins": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST"],
            "AllowedHeaders": ["*"],
            "MaxAgeSeconds": 3600
        }]
    }' \
    --endpoint-url ${ENDPOINT} \
    --region ${REGION} \
    > /dev/null 2>&1

echo "✓ S3 bucket ready"

# Create Lambda function
echo ""
echo "Creating Lambda function..."

# Create a simple Lambda function code
cat > /tmp/lambda-handler.js << 'EOF'
exports.handler = async (event) => {
    console.log('Sandbox execution:', JSON.stringify(event));
    
    const { repoUrl, commands, environment } = event;
    
    // Simulate code execution
    return {
        success: true,
        stdout: 'Sandbox execution completed',
        stderr: '',
        exitCode: 0,
        executionTime: 1000
    };
};
EOF

# Zip the Lambda function
cd /tmp
zip lambda-function.zip lambda-handler.js > /dev/null

# Create Lambda function
aws lambda create-function \
    --function-name ${FUNCTION_NAME} \
    --runtime nodejs20.x \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --handler lambda-handler.handler \
    --zip-file fileb://lambda-function.zip \
    --timeout 300 \
    --memory-size 1024 \
    --endpoint-url ${ENDPOINT} \
    --region ${REGION} \
    > /dev/null 2>&1 || echo "Function already exists"

# Clean up
rm lambda-function.zip lambda-handler.js

echo "✓ Lambda function ready"

echo ""
echo "========================================="
echo "LocalStack Initialization Complete!"
echo "========================================="
echo ""
echo "Services available at: ${ENDPOINT}"
echo "DynamoDB Table: ${TABLE_NAME}"
echo "S3 Bucket: ${BUCKET_NAME}"
echo "Lambda Function: ${FUNCTION_NAME}"
echo ""
echo "Add to your .env.local:"
echo "LOCALSTACK_ENDPOINT=http://localhost:4566"
echo "DYNAMODB_ENDPOINT=http://localhost:4566"
echo "S3_ENDPOINT=http://localhost:4566"
echo "AWS_ACCESS_KEY_ID=test"
echo "AWS_SECRET_ACCESS_KEY=test"
echo "AWS_REGION=ap-south-1"
echo ""
