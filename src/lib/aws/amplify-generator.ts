/**
 * Amplify Config Generator
 * Generates AWS Amplify and SAM deployment configurations
 * Detects project type and generates appropriate config with validation
 */

import { BedrockLLMClient } from './bedrock';

export type ProjectType = 'nextjs' | 'react' | 'vue' | 'angular' | 'express' | 'fastify' | 'flask' | 'fastapi' | 'unknown';

export interface ProjectDetectionResult {
  type: ProjectType;
  framework: string;
  buildCommand: string;
  outputDir: string;
  hasServerless: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'pip' | null;
  dependencies: string[];
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DeploymentSimulationResult {
  success: boolean;
  issues: string[];
  fixes: Array<{ issue: string; fix: string }>;
}

// Build configuration templates for each project type
const BUILD_CONFIGS: Record<ProjectType, { buildCommand: string; outputDir: string }> = {
  nextjs: { buildCommand: 'npm run build', outputDir: '.next' },
  react: { buildCommand: 'npm run build', outputDir: 'build' },
  vue: { buildCommand: 'npm run build', outputDir: 'dist' },
  angular: { buildCommand: 'npm run build', outputDir: 'dist' },
  express: { buildCommand: 'npm run build', outputDir: 'dist' },
  fastify: { buildCommand: 'npm run build', outputDir: 'dist' },
  flask: { buildCommand: 'pip install -r requirements.txt', outputDir: '.' },
  fastapi: { buildCommand: 'pip install -r requirements.txt', outputDir: '.' },
  unknown: { buildCommand: 'npm run build', outputDir: 'dist' },
};

export class AmplifyConfigGenerator {
  private bedrock: BedrockLLMClient;

  constructor(bedrock?: BedrockLLMClient) {
    this.bedrock = bedrock || new BedrockLLMClient();
  }

  /**
   * Detect project type from repository files
   */
  async detectProjectType(packageJson?: any, files?: string[]): Promise<ProjectDetectionResult> {
    const result: ProjectDetectionResult = {
      type: 'unknown',
      framework: 'Unknown',
      buildCommand: 'npm run build',
      outputDir: 'dist',
      hasServerless: false,
      packageManager: null,
      dependencies: [],
    };

    if (!packageJson && !files) {
      return result;
    }

    // Detect from package.json
    if (packageJson) {
      result.packageManager = 'npm';
      const allDeps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };
      result.dependencies = Object.keys(allDeps);

      // Next.js
      if (allDeps.next) {
        result.type = 'nextjs';
        result.framework = `Next.js ${allDeps.next}`;
        result.buildCommand = 'npm run build';
        result.outputDir = '.next';
      }
      // React (CRA or Vite)
      else if (allDeps.react && (allDeps['react-scripts'] || allDeps.vite)) {
        result.type = 'react';
        result.framework = allDeps.vite ? 'React + Vite' : 'Create React App';
        result.buildCommand = 'npm run build';
        result.outputDir = allDeps.vite ? 'dist' : 'build';
      }
      // Vue
      else if (allDeps.vue) {
        result.type = 'vue';
        result.framework = `Vue.js ${allDeps.vue}`;
        result.buildCommand = 'npm run build';
        result.outputDir = 'dist';
      }
      // Angular
      else if (allDeps['@angular/core']) {
        result.type = 'angular';
        result.framework = `Angular ${allDeps['@angular/core']}`;
        result.buildCommand = 'npm run build';
        result.outputDir = 'dist';
      }
      // Express
      else if (allDeps.express) {
        result.type = 'express';
        result.framework = 'Express.js';
        result.hasServerless = true;
        result.buildCommand = packageJson.scripts?.build ? 'npm run build' : 'echo "No build step"';
        result.outputDir = 'dist';
      }
      // Fastify
      else if (allDeps.fastify) {
        result.type = 'fastify';
        result.framework = 'Fastify';
        result.hasServerless = true;
        result.buildCommand = packageJson.scripts?.build ? 'npm run build' : 'echo "No build step"';
        result.outputDir = 'dist';
      }
    }

    // Detect Python projects from file list
    if (files) {
      if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) {
        result.packageManager = 'pip';

        if (files.some(f => f.includes('flask'))) {
          result.type = 'flask';
          result.framework = 'Flask';
          result.hasServerless = true;
        } else if (files.some(f => f.includes('fastapi'))) {
          result.type = 'fastapi';
          result.framework = 'FastAPI';
          result.hasServerless = true;
        }
      }

      // Detect yarn/pnpm
      if (files.includes('yarn.lock')) result.packageManager = 'yarn';
      if (files.includes('pnpm-lock.yaml')) result.packageManager = 'pnpm';
    }

    return result;
  }

  /**
   * Generate amplify.yml configuration for frontend projects
   */
  async generateAmplifyConfig(detection: ProjectDetectionResult): Promise<string> {
    const installCommand = detection.packageManager === 'yarn'
      ? 'yarn install'
      : detection.packageManager === 'pnpm'
        ? 'pnpm install'
        : 'npm ci';

    const config = BUILD_CONFIGS[detection.type] || BUILD_CONFIGS.unknown;

    let amplifyYml = `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - ${installCommand}
    build:
      commands:
        - ${config.buildCommand}
  artifacts:
    baseDirectory: ${config.outputDir}
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*`;

    // Add Next.js specific settings
    if (detection.type === 'nextjs') {
      amplifyYml += `
  customHeaders:
    - pattern: '**/*'
      headers:
        - key: 'Strict-Transport-Security'
          value: 'max-age=31536000; includeSubDomains'
        - key: 'X-Content-Type-Options'
          value: 'nosniff'
        - key: 'X-Frame-Options'
          value: 'DENY'`;
    }

    // Add environment variables placeholder
    amplifyYml += `
  environmentVariables:
    - name: NODE_ENV
      value: production`;

    return amplifyYml;
  }

  /**
   * Generate AWS SAM template for serverless backends
   */
  async generateSAMTemplate(detection: ProjectDetectionResult): Promise<string> {
    const isNode = ['express', 'fastify', 'nextjs'].includes(detection.type);
    const runtime = isNode ? 'nodejs20.x' : 'python3.12';
    const handler = isNode ? 'dist/handler.handler' : 'app.handler';
    const codeUri = isNode ? '.' : '.';

    const template = `AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: >
  ${detection.framework} application deployed as serverless

Globals:
  Function:
    Timeout: 30
    MemorySize: 512
    Runtime: ${runtime}
    Architectures:
      - x86_64
    Environment:
      Variables:
        NODE_ENV: production

Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ${codeUri}
      Handler: ${handler}
      Description: Main API handler
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /{proxy+}
            Method: ANY
        RootEvent:
          Type: Api
          Properties:
            Path: /
            Method: ANY
      Policies:
        - AWSLambdaBasicExecutionRole

Outputs:
  ApiUrl:
    Description: API Gateway URL
    Value: !Sub "https://\${ServerlessRestApi}.execute-api.\${AWS::Region}.amazonaws.com/Prod/"
  FunctionArn:
    Description: Lambda Function ARN
    Value: !GetAtt ApiFunction.Arn`;

    return template;
  }

  /**
   * Validate configuration syntax
   */
  async validateConfig(
    configContent: string,
    type: 'amplify' | 'sam'
  ): Promise<ConfigValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (type === 'amplify') {
      // Validate amplify.yml structure
      if (!configContent.includes('version:')) {
        errors.push('Missing required "version" field');
      }
      if (!configContent.includes('frontend:') && !configContent.includes('backend:')) {
        errors.push('Must contain either "frontend" or "backend" section');
      }
      if (!configContent.includes('phases:')) {
        errors.push('Missing "phases" section');
      }
      if (!configContent.includes('build:')) {
        errors.push('Missing "build" phase');
      }
      if (!configContent.includes('artifacts:')) {
        errors.push('Missing "artifacts" section');
      }
      if (!configContent.includes('baseDirectory:')) {
        warnings.push('No "baseDirectory" specified in artifacts');
      }
      if (!configContent.includes('cache:')) {
        warnings.push('No cache configuration specified - builds may be slower');
      }
    } else if (type === 'sam') {
      // Validate SAM template structure
      if (!configContent.includes('AWSTemplateFormatVersion:')) {
        errors.push('Missing "AWSTemplateFormatVersion" field');
      }
      if (!configContent.includes('Transform:')) {
        errors.push('Missing "Transform" field - required for SAM');
      }
      if (!configContent.includes('AWS::Serverless-2016-10-31')) {
        errors.push('Transform must include "AWS::Serverless-2016-10-31"');
      }
      if (!configContent.includes('Resources:')) {
        errors.push('Missing "Resources" section');
      }
      if (!configContent.includes('AWS::Serverless::Function')) {
        warnings.push('No Lambda function defined');
      }
      if (!configContent.includes('Handler:')) {
        errors.push('Missing "Handler" for Lambda function');
      }
      if (!configContent.includes('Runtime:')) {
        errors.push('Missing "Runtime" for Lambda function');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Simulate deployment to catch issues
   */
  async simulateDeployment(configContent: string): Promise<DeploymentSimulationResult> {
    const issues: string[] = [];
    const fixes: Array<{ issue: string; fix: string }> = [];

    // Check for common issues
    if (configContent.includes('${') && !configContent.includes('!Sub')) {
      issues.push('Variable substitution used without !Sub intrinsic function');
      fixes.push({
        issue: 'Variable substitution',
        fix: 'Use !Sub for CloudFormation variable substitution',
      });
    }

    // Check for hardcoded credentials
    const credentialPatterns = [
      /aws_access_key_id/i,
      /aws_secret_access_key/i,
      /password\s*[:=]/i,
      /api_key\s*[:=]/i,
    ];

    for (const pattern of credentialPatterns) {
      if (pattern.test(configContent)) {
        issues.push(`Potential hardcoded credential detected: ${pattern.source}`);
        fixes.push({
          issue: 'Hardcoded credentials',
          fix: 'Use environment variables or AWS Secrets Manager for sensitive values',
        });
      }
    }

    // Check for missing environment variables
    const envVarRefs = configContent.match(/\$\{([^}]+)\}/g) || [];
    for (const ref of envVarRefs) {
      const varName = ref.replace('${', '').replace('}', '');
      if (!configContent.includes(`${varName}:`) && !varName.startsWith('AWS::')) {
        issues.push(`Referenced variable "${varName}" may not be defined`);
        fixes.push({
          issue: `Undefined variable: ${varName}`,
          fix: `Add "${varName}" to the Parameters or Environment section`,
        });
      }
    }

    return {
      success: issues.length === 0,
      issues,
      fixes,
    };
  }
}
