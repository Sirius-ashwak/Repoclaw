/**
 * Base agent interface and abstract class
 * All agents extend this base to ensure consistent behavior
 */

import type { BaseAgent, AgentContext, AgentResult, AgentType, AgentStatus } from '@/types';
import { getAgentTimeout } from '@/lib/config';

export abstract class Agent implements BaseAgent {
  abstract type: AgentType;
  
  /**
   * Execute the agent's main logic
   * Must be implemented by each specific agent
   */
  abstract execute(context: AgentContext): Promise<AgentResult>;
  
  /**
   * Execute with timeout protection
   */
  async executeWithTimeout(context: AgentContext): Promise<AgentResult> {
    const timeout = getAgentTimeout(this.type);
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        this.execute(context),
        this.createTimeoutPromise(timeout),
      ]);
      
      const executionTime = Date.now() - startTime;
      return {
        ...result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return this.createErrorResult(error, executionTime);
    }
  }
  
  /**
   * Create a timeout promise that rejects after specified duration
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Agent ${this.type} timed out after ${timeout}ms`));
      }, timeout);
    });
  }
  
  /**
   * Create an error result
   */
  protected createErrorResult(error: unknown, executionTime: number): AgentResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      agent: this.type,
      status: 'failed' as AgentStatus,
      artifacts: [],
      error: errorMessage,
      executionTime,
      metadata: {},
    };
  }
  
  /**
   * Create a success result
   */
  protected createSuccessResult(
    artifacts: AgentResult['artifacts'],
    metadata: Record<string, any> = {},
    executionTime: number = 0
  ): AgentResult {
    return {
      agent: this.type,
      status: 'completed' as AgentStatus,
      artifacts,
      error: null,
      executionTime,
      metadata,
    };
  }
  
  /**
   * Log agent activity
   */
  protected log(message: string, data?: any): void {
    console.log(`[${this.type.toUpperCase()}] ${message}`, data || '');
  }
  
  /**
   * Log agent errors
   */
  protected logError(message: string, error?: any): void {
    console.error(`[${this.type.toUpperCase()}] ERROR: ${message}`, error || '');
  }
}

/**
 * Utility function to validate agent context
 */
export function validateAgentContext(context: AgentContext): void {
  if (!context.sessionId) {
    throw new Error('Session ID is required');
  }
  if (!context.repoMetadata) {
    throw new Error('Repository metadata is required');
  }
  if (!context.githubToken) {
    throw new Error('GitHub token is required');
  }
  if (!context.mode) {
    throw new Error('Mode is required');
  }
}
