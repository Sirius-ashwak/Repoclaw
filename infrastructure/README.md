# RepoClaw AWS Infrastructure

This directory contains AWS infrastructure configuration and deployment scripts for RepoClaw.

## Overview

RepoClaw uses the following AWS services:
- **DynamoDB**: Session storage with 24-hour TTL
- **S3**: Artifact storage with 7-day lifecycle policy
- **Lambda**: Code sandbox for secure execution
- **Bedrock**: LLM inference (Claude 3.5 Sonnet + Llama 3)
- **Translate**: Multi-language support (5 Indian languages)
- **Polly**: Text-to-speech for pitch audio

## Prerequisites

- AWS CLI installed and configured
- AWS account with appropriate permissions
- Node.js 18+ for local development
- Docker and Docker Compose for LocalStack

## Production Deployment

### 1. Deploy Infrastructure

```bash
cd infrastructure
chmod +x deploy.sh
./deploy.sh production
```

This will create:
- DynamoDB table: `repoclaw-sessions-production`
- S3 bucket: `repoclaw-artifacts-production-{account-id}`
- Lambda function: `repoclaw-code-sandbox-production`
- IAM roles with appropriate permissions

### 2. Configure Environment Variables

Copy the output from the deployment script to your `.env` file:

```bash
AWS_REGION=ap-south-1
DYNAMODB_TABLE_NAME=repoclaw-sessions-production
S3_BUCKET_NAME=repoclaw-artifacts-production-123456789012
LAMBDA_SANDBOX_FUNCTION=repoclaw-code-sandbox-production
```

### 3. Enable Bedrock Models

Go to AWS Console → Bedrock → Model access and enable:
- Anthropic Claude 3.5 Sonnet
- Meta Llama 3 70B Instruct

## Local Development with LocalStack

LocalStack provides a local AWS cloud stack for development and testing.

### 1. Start LocalStack

```bash
# Start LocalStack and Ollama
docker-compose up -d

# Wait for services to be ready
docker-compose logs -f localstack
```

### 2. Initialize LocalStack

```bash
cd infrastructure
chmod +x localstack-init.sh
./localstack-init.sh
```

### 3. Configure Local Environment

Create `.env.local`:

```bash
# LocalStack endpoints
LOCALSTACK_ENDPOINT=http://localhost:4566
DYNAMODB_ENDPOINT=http://localhost:4566
S3_ENDPOINT=http://localhost:4566

# LocalStack credentials
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=ap-south-1

# Table and bucket names
DYNAMODB_TABLE_NAME=repoclaw-sessions
S3_BUCKET_NAME=repoclaw-artifacts
LAMBDA_SANDBOX_FUNCTION=repoclaw-code-sandbox
```

### 4. Verify LocalStack

```bash
# Check DynamoDB table
aws dynamodb describe-table \
  --table-name repoclaw-sessions \
  --endpoint-url http://localhost:4566

# Check S3 bucket
aws s3 ls s3://repoclaw-artifacts \
  --endpoint-url http://localhost:4566

# Check Lambda function
aws lambda get-function \
  --function-name repoclaw-code-sandbox \
  --endpoint-url http://localhost:4566
```

## Infrastructure Components

### DynamoDB Table Schema

```
Table: repoclaw-sessions
- PK (String, Hash Key): "SESSION#<id>" | "PIPELINE#<id>" | "APPROVAL#<id>"
- SK (String, Range Key): "METADATA" | "STATE" | "GATE"
- EntityType (String): "session" | "pipeline" | "approval"
- TTL (Number): Unix timestamp for auto-deletion
- Data (Map): Session | PipelineState | ApprovalGate
- CreatedAt (Number): Unix timestamp
- UpdatedAt (Number): Unix timestamp
- Version (Number): For optimistic locking

GSI: EntityType-CreatedAt-index
- Allows querying all sessions or pipelines by creation time
```

### S3 Bucket Structure

```
repoclaw-artifacts/
  <pipelineId>/
    pdfs/
      README.pdf
      API_DOCS.pdf
    diagrams/
      architecture.png
    audio/
      pitch_en.mp3
      pitch_hi.mp3
```

### Lambda Function

- **Runtime**: Node.js 20.x
- **Memory**: 1024 MB
- **Timeout**: 5 minutes
- **Ephemeral Storage**: 512 MB
- **Network**: Isolated (no internet access except AWS services)

## Cost Estimation

Based on 1000 pipeline executions per day:

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| DynamoDB | 30K writes, 60K reads | ~$0.50 |
| S3 | 10GB storage, 30K requests | ~$0.30 |
| Lambda | 5K minutes execution | ~$0.80 |
| Bedrock | 50M tokens (mixed) | ~$15.00 |
| Translate | 10M characters | ~$15.00 |
| Polly | 5M characters | ~$20.00 |
| **Total** | | **~$51.60** |

**Per pipeline**: ~$0.05 (well under $0.50 target)

## Security

- All data encrypted at rest (DynamoDB, S3)
- IAM roles follow least privilege principle
- Lambda sandboxes have no network access
- S3 pre-signed URLs expire after 1 hour
- Public access blocked on S3 bucket

## Monitoring

CloudWatch logs are automatically created for:
- Lambda function executions
- Application logs
- API Gateway requests

View logs:
```bash
aws logs tail /aws/lambda/repoclaw-code-sandbox-production --follow
```

## Cleanup

To delete all infrastructure:

```bash
aws cloudformation delete-stack \
  --stack-name repoclaw-infrastructure-production \
  --region ap-south-1
```

**Warning**: This will delete all data including sessions and artifacts.

## Troubleshooting

### LocalStack not starting

```bash
# Check Docker is running
docker ps

# Restart LocalStack
docker-compose restart localstack

# View logs
docker-compose logs localstack
```

### Bedrock models not available

Bedrock models must be explicitly enabled in your AWS account:
1. Go to AWS Console → Bedrock
2. Click "Model access"
3. Enable Claude 3.5 Sonnet and Llama 3
4. Wait for approval (usually instant)

### Lambda timeout errors

Increase timeout in CloudFormation template:
```yaml
Timeout: 300  # 5 minutes
```

Then redeploy:
```bash
./deploy.sh production
```

## Support

For issues with AWS infrastructure, check:
- CloudFormation stack events in AWS Console
- CloudWatch logs for error details
- IAM role permissions
