/**
 * AWS Configuration
 * Central configuration for all AWS services used in RepoClaw
 */

export interface AWSConfig {
  region: string;
  dynamodb: {
    tableName: string;
    endpoint?: string; // For local testing with LocalStack
  };
  s3: {
    bucketName: string;
    urlExpiration: number; // seconds
    endpoint?: string;
  };
  bedrock: {
    region: string;
    models: {
      complex: string; // Claude 3.5 Sonnet
      simple: string;  // Llama 3
    };
  };
  lambda: {
    sandboxFunctionName: string;
    timeout: number; // milliseconds
  };
  translate: {
    customTerminologyName?: string;
  };
  polly: {
    voiceMap: Record<string, string>;
  };
}

/**
 * Get AWS configuration from environment variables
 */
export function getAWSConfig(): AWSConfig {
  const region = process.env.AWS_REGION || 'ap-south-1'; // Mumbai region for low latency to India
  
  return {
    region,
    dynamodb: {
      tableName: process.env.DYNAMODB_TABLE_NAME || 'repoclaw-sessions',
      endpoint: process.env.DYNAMODB_ENDPOINT, // For LocalStack
    },
    s3: {
      bucketName: process.env.S3_BUCKET_NAME || 'repoclaw-artifacts',
      urlExpiration: 3600, // 1 hour
      endpoint: process.env.S3_ENDPOINT,
    },
    bedrock: {
      region: process.env.BEDROCK_REGION || region,
      models: {
        complex: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        simple: 'meta.llama3-70b-instruct-v1:0',
      },
    },
    lambda: {
      sandboxFunctionName: process.env.LAMBDA_SANDBOX_FUNCTION || 'repoclaw-code-sandbox',
      timeout: 300000, // 5 minutes
    },
    translate: {
      customTerminologyName: process.env.TRANSLATE_TERMINOLOGY_NAME,
    },
    polly: {
      voiceMap: {
        hi: 'Aditi',    // Hindi (Neural)
        ta: 'Kajal',    // Tamil (Neural)
        te: 'Kajal',    // Telugu (use Tamil voice)
        bn: 'Aditi',    // Bengali (use Hindi voice)
        mr: 'Aditi',    // Marathi (use Hindi voice)
        en: 'Joanna',   // English (Neural)
      },
    },
  };
}

/**
 * Validate AWS configuration
 */
export function validateAWSConfig(config: AWSConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.region) {
    errors.push('AWS region is required');
  }

  if (!config.dynamodb.tableName) {
    errors.push('DynamoDB table name is required');
  }

  if (!config.s3.bucketName) {
    errors.push('S3 bucket name is required');
  }

  if (!config.lambda.sandboxFunctionName) {
    errors.push('Lambda sandbox function name is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if running in local development mode
 */
export function isLocalDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' && !!process.env.LOCALSTACK_ENDPOINT;
}

/**
 * Get endpoint for LocalStack (local AWS emulation)
 */
export function getLocalStackEndpoint(): string | undefined {
  return process.env.LOCALSTACK_ENDPOINT;
}
