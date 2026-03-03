#!/bin/bash

# RepoClaw AWS Infrastructure Deployment Script
# Deploys DynamoDB, S3, Lambda, and IAM resources using CloudFormation

set -e

# Configuration
PROJECT_NAME="repoclaw"
ENVIRONMENT="${1:-production}"
REGION="${AWS_REGION:-ap-south-1}"
STACK_NAME="${PROJECT_NAME}-infrastructure-${ENVIRONMENT}"
TEMPLATE_FILE="cloudformation-template.yaml"

echo "========================================="
echo "RepoClaw AWS Infrastructure Deployment"
echo "========================================="
echo "Project: ${PROJECT_NAME}"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "Stack: ${STACK_NAME}"
echo "========================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if user is authenticated
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured"
    echo "Run: aws configure"
    exit 1
fi

# Validate CloudFormation template
echo ""
echo "Validating CloudFormation template..."
aws cloudformation validate-template \
    --template-body file://${TEMPLATE_FILE} \
    --region ${REGION} \
    > /dev/null

echo "✓ Template is valid"

# Check if stack exists
STACK_EXISTS=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    2>&1 || true)

if echo "${STACK_EXISTS}" | grep -q "does not exist"; then
    echo ""
    echo "Creating new stack..."
    aws cloudformation create-stack \
        --stack-name ${STACK_NAME} \
        --template-body file://${TEMPLATE_FILE} \
        --parameters \
            ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \
            ParameterKey=ProjectName,ParameterValue=${PROJECT_NAME} \
        --capabilities CAPABILITY_NAMED_IAM \
        --region ${REGION}
    
    echo "Waiting for stack creation to complete..."
    aws cloudformation wait stack-create-complete \
        --stack-name ${STACK_NAME} \
        --region ${REGION}
    
    echo "✓ Stack created successfully"
else
    echo ""
    echo "Updating existing stack..."
    UPDATE_OUTPUT=$(aws cloudformation update-stack \
        --stack-name ${STACK_NAME} \
        --template-body file://${TEMPLATE_FILE} \
        --parameters \
            ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \
            ParameterKey=ProjectName,ParameterValue=${PROJECT_NAME} \
        --capabilities CAPABILITY_NAMED_IAM \
        --region ${REGION} \
        2>&1 || true)
    
    if echo "${UPDATE_OUTPUT}" | grep -q "No updates are to be performed"; then
        echo "✓ No changes detected"
    else
        echo "Waiting for stack update to complete..."
        aws cloudformation wait stack-update-complete \
            --stack-name ${STACK_NAME} \
            --region ${REGION}
        
        echo "✓ Stack updated successfully"
    fi
fi

# Get stack outputs
echo ""
echo "========================================="
echo "Stack Outputs"
echo "========================================="
aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

# Export environment variables
echo ""
echo "========================================="
echo "Environment Variables"
echo "========================================="
echo "Add these to your .env file:"
echo ""

DYNAMODB_TABLE=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' \
    --output text)

S3_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text)

LAMBDA_FUNCTION=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionName`].OutputValue' \
    --output text)

APP_ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[?OutputKey==`ApplicationRoleArn`].OutputValue' \
    --output text)

echo "AWS_REGION=${REGION}"
echo "DYNAMODB_TABLE_NAME=${DYNAMODB_TABLE}"
echo "S3_BUCKET_NAME=${S3_BUCKET}"
echo "LAMBDA_SANDBOX_FUNCTION=${LAMBDA_FUNCTION}"
echo "AWS_APP_ROLE_ARN=${APP_ROLE_ARN}"
echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
