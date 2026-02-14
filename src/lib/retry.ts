/**
 * Retry Mechanism
 * Handles retry logic for failed operations with exponential backoff
 */

import { getPipeline, updatePipeline } from './kv';
import { AgentType, PipelineState } from '@/types';
import { logSystemError } from './error-logger';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxAttempts, initialDelay, maxDelay, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        break;
      }

      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
      
      // Exponential backoff with max delay cap
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Resume pipeline from failed step
 */
export async function resumePipelineFromFailure(
  pipelineId: string,
  failedAgent: AgentType
): Promise<void> {
  const pipeline = await getPipeline(pipelineId);
  
  if (!pipeline) {
    throw new Error(`Pipeline ${pipelineId} not found`);
  }

  if (pipeline.status !== 'failed') {
    throw new Error(`Pipeline ${pipelineId} is not in failed state`);
  }

  // Reset pipeline to resume from failed agent
  await updatePipeline(pipelineId, {
    status: 'running',
    currentAgent: failedAgent,
    error: null,
    timestamps: {
      ...pipeline.timestamps,
      retry_started: Date.now(),
      [`${failedAgent}_retry`]: Date.now(),
    },
  });

  console.log(`Pipeline ${pipelineId} resumed from ${failedAgent}`);
}

/**
 * Check if pipeline can be retried
 */
export function canRetryPipeline(pipeline: PipelineState): boolean {
  // Can only retry failed pipelines
  if (pipeline.status !== 'failed') {
    return false;
  }

  // Check if error is recoverable
  if (pipeline.error && !pipeline.error.recoverable) {
    return false;
  }

  // Check retry count (max 3 retries per agent)
  const failedAgent = pipeline.error?.agent;
  if (failedAgent) {
    const retryKey = `${failedAgent}_retry`;
    const retryTimestamps = Object.keys(pipeline.timestamps).filter((key) =>
      key.startsWith(retryKey)
    );
    
    if (retryTimestamps.length >= 3) {
      return false;
    }
  }

  return true;
}

/**
 * Get retry count for an agent
 */
export function getRetryCount(pipeline: PipelineState, agent: AgentType): number {
  const retryKey = `${agent}_retry`;
  return Object.keys(pipeline.timestamps).filter((key) => key.startsWith(retryKey)).length;
}

/**
 * Create retry button component data
 */
export interface RetryButtonData {
  canRetry: boolean;
  retryCount: number;
  maxRetries: number;
  failedAgent: AgentType | null;
  errorMessage: string | null;
}

export function getRetryButtonData(pipeline: PipelineState): RetryButtonData {
  const canRetry = canRetryPipeline(pipeline);
  const failedAgent = pipeline.error?.agent || null;
  const retryCount = failedAgent ? getRetryCount(pipeline, failedAgent) : 0;

  return {
    canRetry,
    retryCount,
    maxRetries: 3,
    failedAgent,
    errorMessage: pipeline.error?.message || null,
  };
}

/**
 * Handle retry request from user
 */
export async function handleRetryRequest(pipelineId: string): Promise<void> {
  const pipeline = await getPipeline(pipelineId);
  
  if (!pipeline) {
    throw new Error(`Pipeline ${pipelineId} not found`);
  }

  if (!canRetryPipeline(pipeline)) {
    const reason = pipeline.status !== 'failed'
      ? 'Pipeline is not in failed state'
      : pipeline.error && !pipeline.error.recoverable
      ? 'Error is not recoverable'
      : 'Maximum retry attempts reached';
    
    await logSystemError(
      pipelineId,
      'Retry request denied',
      reason,
      false
    );
    
    throw new Error(`Cannot retry pipeline: ${reason}`);
  }

  const failedAgent = pipeline.error?.agent;
  if (!failedAgent) {
    throw new Error('Cannot determine failed agent for retry');
  }

  await resumePipelineFromFailure(pipelineId, failedAgent);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry API call with exponential backoff
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  errorContext: string
): Promise<T> {
  return retryWithBackoff(apiCall, {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  }).catch((error) => {
    console.error(`API call failed after retries: ${errorContext}`, error);
    throw error;
  });
}
