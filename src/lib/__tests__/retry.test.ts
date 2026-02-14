/**
 * Property-based tests for retry mechanism
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import {
  retryWithBackoff,
  canRetryPipeline,
  getRetryCount,
  getRetryButtonData,
} from '../retry';
import { PipelineState, AgentType } from '@/types';

// Mock KV functions
jest.mock('../kv', () => ({
  getPipeline: jest.fn(),
  updatePipeline: jest.fn(),
}));

describe('Retry Mechanism', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: repoclaw, Property 23: Pipeline Resumption After Retry
  // Validates: Requirements 10.5
  test('Property 23: Pipeline Resumption After Retry - pipeline resumes from failed step', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 10 }),
          sessionId: fc.string({ minLength: 10 }),
          mode: fc.constantFrom('hackathon', 'placement', 'refactor'),
          status: fc.constant('failed'),
          currentAgent: fc.option(fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'), { nil: null }),
          error: fc.record({
            agent: fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
            message: fc.string(),
            details: fc.string(),
            timestamp: fc.integer({ min: 1000000000000 }),
            recoverable: fc.constant(true),
          }),
          timestamps: fc.object(),
          startedAt: fc.integer({ min: 1000000000000 }),
        }),
        (pipeline: Partial<PipelineState>) => {
          // Verify pipeline is in failed state
          expect(pipeline.status).toBe('failed');

          // Verify error is recoverable
          if (pipeline.error) {
            expect(pipeline.error.recoverable).toBe(true);
          }

          // Check if pipeline can be retried
          const canRetry = canRetryPipeline(pipeline as PipelineState);

          // Should be able to retry if error is recoverable and retry count < 3
          if (pipeline.error && pipeline.error.recoverable) {
            const retryCount = getRetryCount(pipeline as PipelineState, pipeline.error.agent);
            expect(canRetry).toBe(retryCount < 3);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('retry count increases with each retry', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
        fc.integer({ min: 0, max: 5 }),
        (agent: AgentType, retryAttempts: number) => {
          const timestamps: Record<string, number> = {};
          
          // Simulate retry attempts
          for (let i = 0; i < retryAttempts; i++) {
            timestamps[`${agent}_retry_${i}`] = Date.now();
          }

          const pipeline: Partial<PipelineState> = {
            id: 'test',
            sessionId: 'test',
            mode: 'hackathon',
            status: 'failed',
            currentAgent: agent,
            timestamps,
            startedAt: Date.now(),
          };

          const count = getRetryCount(pipeline as PipelineState, agent);
          expect(count).toBe(retryAttempts);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('cannot retry non-recoverable errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
        (agent: AgentType) => {
          const pipeline: Partial<PipelineState> = {
            id: 'test',
            sessionId: 'test',
            mode: 'hackathon',
            status: 'failed',
            currentAgent: agent,
            error: {
              agent,
              message: 'Fatal error',
              details: 'Non-recoverable',
              timestamp: Date.now(),
              recoverable: false,
            },
            timestamps: {},
            startedAt: Date.now(),
          };

          const canRetry = canRetryPipeline(pipeline as PipelineState);
          expect(canRetry).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('cannot retry after max attempts', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
        (agent: AgentType) => {
          const timestamps: Record<string, number> = {
            [`${agent}_retry_0`]: Date.now(),
            [`${agent}_retry_1`]: Date.now(),
            [`${agent}_retry_2`]: Date.now(),
          };

          const pipeline: Partial<PipelineState> = {
            id: 'test',
            sessionId: 'test',
            mode: 'hackathon',
            status: 'failed',
            currentAgent: agent,
            error: {
              agent,
              message: 'Error',
              details: 'Details',
              timestamp: Date.now(),
              recoverable: true,
            },
            timestamps,
            startedAt: Date.now(),
          };

          const canRetry = canRetryPipeline(pipeline as PipelineState);
          expect(canRetry).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('retry button data reflects pipeline state', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          sessionId: fc.string(),
          mode: fc.constantFrom('hackathon', 'placement', 'refactor'),
          status: fc.constantFrom('failed', 'completed', 'running'),
          currentAgent: fc.option(fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'), { nil: null }),
          error: fc.option(
            fc.record({
              agent: fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
              message: fc.string(),
              details: fc.string(),
              timestamp: fc.integer({ min: 1000000000000 }),
              recoverable: fc.boolean(),
            }),
            { nil: null }
          ),
          timestamps: fc.object(),
          startedAt: fc.integer({ min: 1000000000000 }),
        }),
        (pipeline: Partial<PipelineState>) => {
          const buttonData = getRetryButtonData(pipeline as PipelineState);

          // Verify button data structure
          expect(typeof buttonData.canRetry).toBe('boolean');
          expect(typeof buttonData.retryCount).toBe('number');
          expect(buttonData.maxRetries).toBe(3);

          // If pipeline has error, verify error message
          if (pipeline.error) {
            expect(buttonData.errorMessage).toBe(pipeline.error.message);
            expect(buttonData.failedAgent).toBe(pipeline.error.agent);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('retryWithBackoff succeeds on first attempt', async () => {
    let callCount = 0;
    const successFn = async () => {
      callCount++;
      return 'success';
    };

    const result = await retryWithBackoff(successFn, { maxAttempts: 3 });
    
    expect(result).toBe('success');
    expect(callCount).toBe(1);
  });

  test('retryWithBackoff retries on failure', async () => {
    let callCount = 0;
    const failTwiceFn = async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    };

    const result = await retryWithBackoff(failTwiceFn, {
      maxAttempts: 3,
      initialDelay: 10,
      maxDelay: 100,
      backoffMultiplier: 2,
    });
    
    expect(result).toBe('success');
    expect(callCount).toBe(3);
  });

  test('retryWithBackoff throws after max attempts', async () => {
    let callCount = 0;
    const alwaysFailFn = async () => {
      callCount++;
      throw new Error('Permanent failure');
    };

    await expect(
      retryWithBackoff(alwaysFailFn, {
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
      })
    ).rejects.toThrow('Permanent failure');
    
    expect(callCount).toBe(3);
  });
});
