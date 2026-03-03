/**
 * Lambda Sandbox Executor
 * Executes untrusted code in isolated Lambda environments
 * Supports running tests, linting, and security scans with 5-minute timeout
 */

import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda';
import { getAWSConfig } from './config';

export interface SandboxConfig {
  region: string;
  functionName: string;
  timeout: number; // milliseconds
}

export interface SandboxPayload {
  repoUrl: string;
  commands: string[];
  environment?: Record<string, string>;
  timeout?: number;
}

export interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number; // milliseconds
  error?: string;
}

export interface LintResult extends SandboxResult {
  errorCount: number;
  warningCount: number;
  fixableCount: number;
  issues: Array<{
    file: string;
    line: number;
    column: number;
    severity: 'error' | 'warning';
    message: string;
    rule: string;
  }>;
}

export interface SecurityScanResult extends SandboxResult {
  vulnerabilities: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    package: string;
    description: string;
    fixAvailable: boolean;
  }>;
  totalVulnerabilities: number;
}

export class LambdaSandboxExecutor {
  private client: LambdaClient;
  private functionName: string;
  private timeout: number;

  constructor(config?: SandboxConfig) {
    const awsConfig = getAWSConfig();
    const sandboxConfig = config || {
      region: awsConfig.region,
      functionName: awsConfig.lambda.sandboxFunctionName,
      timeout: awsConfig.lambda.timeout,
    };

    this.client = new LambdaClient({
      region: sandboxConfig.region,
    });

    this.functionName = sandboxConfig.functionName;
    this.timeout = sandboxConfig.timeout;
  }

  /**
   * Execute arbitrary commands in the Lambda sandbox
   * Commands run sequentially in an isolated environment
   */
  async executeCode(
    repoUrl: string,
    commands: string[],
    environment?: Record<string, string>
  ): Promise<SandboxResult> {
    const payload: SandboxPayload = {
      repoUrl,
      commands,
      environment,
      timeout: this.timeout,
    };

    return await this._invokeLambda(payload);
  }

  /**
   * Run tests for the repository
   * Detects test framework and executes appropriate command
   */
  async runTests(repoUrl: string): Promise<SandboxResult> {
    const commands = [
      // Clone the repo
      'git clone --depth 1 $REPO_URL /tmp/repo',
      'cd /tmp/repo',
      // Detect and install dependencies
      'if [ -f package.json ]; then npm ci --production=false 2>/dev/null || npm install; fi',
      'if [ -f requirements.txt ]; then pip install -r requirements.txt; fi',
      // Run tests based on project type
      'if [ -f package.json ]; then npm test -- --forceExit --detectOpenHandles 2>&1 || true; fi',
      'if [ -f pytest.ini ] || [ -f setup.py ]; then python -m pytest -v 2>&1 || true; fi',
    ];

    return await this._invokeLambda({
      repoUrl,
      commands,
      environment: { REPO_URL: repoUrl },
      timeout: this.timeout,
    });
  }

  /**
   * Run linter for the repository
   * Detects project type and runs appropriate linter
   */
  async runLinter(repoUrl: string): Promise<LintResult> {
    const commands = [
      'git clone --depth 1 $REPO_URL /tmp/repo',
      'cd /tmp/repo',
      'if [ -f package.json ]; then npm ci --production=false 2>/dev/null || npm install; fi',
      // Run ESLint for JS/TS projects
      'if [ -f package.json ]; then npx eslint . --format json 2>&1 || true; fi',
      // Run Pylint for Python projects
      'if [ -f requirements.txt ] || [ -f setup.py ]; then pip install pylint && python -m pylint **/*.py --output-format=json 2>&1 || true; fi',
    ];

    const result = await this._invokeLambda({
      repoUrl,
      commands,
      environment: { REPO_URL: repoUrl },
      timeout: this.timeout,
    });

    // Parse lint output
    const lintResult: LintResult = {
      ...result,
      errorCount: 0,
      warningCount: 0,
      fixableCount: 0,
      issues: [],
    };

    try {
      const jsonOutput = this._extractJsonFromOutput(result.stdout);
      if (jsonOutput && Array.isArray(jsonOutput)) {
        // ESLint JSON format
        for (const fileResult of jsonOutput) {
          if (fileResult.messages && Array.isArray(fileResult.messages)) {
            for (const msg of fileResult.messages) {
              lintResult.issues.push({
                file: fileResult.filePath || '',
                line: msg.line || 0,
                column: msg.column || 0,
                severity: msg.severity === 2 ? 'error' : 'warning',
                message: msg.message || '',
                rule: msg.ruleId || '',
              });

              if (msg.severity === 2) lintResult.errorCount++;
              else lintResult.warningCount++;
              if (msg.fix) lintResult.fixableCount++;
            }
          }
        }
      }
    } catch {
      // Could not parse lint output, return raw result
    }

    return lintResult;
  }

  /**
   * Run security scan for the repository
   * Uses npm audit for Node.js and safety for Python
   */
  async runSecurityScan(repoUrl: string): Promise<SecurityScanResult> {
    const commands = [
      'git clone --depth 1 $REPO_URL /tmp/repo',
      'cd /tmp/repo',
      // npm audit for Node.js projects
      'if [ -f package-lock.json ]; then npm audit --json 2>&1 || true; fi',
      // pip-audit for Python projects
      'if [ -f requirements.txt ]; then pip install pip-audit && pip-audit -r requirements.txt --format json 2>&1 || true; fi',
    ];

    const result = await this._invokeLambda({
      repoUrl,
      commands,
      environment: { REPO_URL: repoUrl },
      timeout: this.timeout,
    });

    const scanResult: SecurityScanResult = {
      ...result,
      vulnerabilities: [],
      totalVulnerabilities: 0,
    };

    try {
      const jsonOutput = this._extractJsonFromOutput(result.stdout);
      if (jsonOutput && jsonOutput.vulnerabilities) {
        // npm audit JSON format
        for (const [name, vuln] of Object.entries(jsonOutput.vulnerabilities) as any) {
          scanResult.vulnerabilities.push({
            severity: vuln.severity || 'medium',
            package: name,
            description: vuln.via?.[0]?.title || vuln.via?.[0] || 'Unknown vulnerability',
            fixAvailable: !!vuln.fixAvailable,
          });
        }
        scanResult.totalVulnerabilities = scanResult.vulnerabilities.length;
      }
    } catch {
      // Could not parse security scan output
    }

    return scanResult;
  }

  /**
   * Internal: Invoke the Lambda sandbox function
   */
  private async _invokeLambda(payload: SandboxPayload): Promise<SandboxResult> {
    const startTime = Date.now();

    try {
      const command = new InvokeCommand({
        FunctionName: this.functionName,
        InvocationType: InvocationType.RequestResponse,
        Payload: new TextEncoder().encode(JSON.stringify(payload)),
      });

      // Apply timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await this.client.send(command, {
          abortSignal: controller.signal,
        });

        clearTimeout(timeoutId);

        const executionTime = Date.now() - startTime;

        // Check for Lambda function errors
        if (response.FunctionError) {
          const errorPayload = response.Payload
            ? JSON.parse(new TextDecoder().decode(response.Payload))
            : { errorMessage: 'Unknown Lambda error' };

          return {
            success: false,
            stdout: '',
            stderr: errorPayload.errorMessage || 'Lambda function error',
            exitCode: 1,
            executionTime,
            error: errorPayload.errorMessage,
          };
        }

        // Parse successful response
        if (response.Payload) {
          const responsePayload = JSON.parse(
            new TextDecoder().decode(response.Payload)
          );

          return {
            success: responsePayload.exitCode === 0,
            stdout: responsePayload.stdout || '',
            stderr: responsePayload.stderr || '',
            exitCode: responsePayload.exitCode || 0,
            executionTime,
          };
        }

        return {
          success: false,
          stdout: '',
          stderr: 'Empty Lambda response',
          exitCode: 1,
          executionTime,
          error: 'Empty Lambda response',
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          stdout: '',
          stderr: `Lambda execution timed out after ${this.timeout / 1000} seconds`,
          exitCode: 124, // Standard timeout exit code
          executionTime,
          error: 'Execution timed out',
        };
      }

      return {
        success: false,
        stdout: '',
        stderr: error.message || 'Unknown error',
        exitCode: 1,
        executionTime,
        error: error.message,
      };
    }
  }

  /**
   * Internal: Extract JSON from mixed stdout output
   */
  private _extractJsonFromOutput(output: string): any | null {
    // Try to find JSON in the output
    const jsonMatch = output.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
