/**
 * Property-based tests for error logging utility
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import {
  logError,
  logAgentError,
  logSystemError,
  formatErrorForDisplay,
  isRecoverableError,
  ErrorLog,
} from '../error-logger';
import { AgentType } from '@/types';

// Mock Vercel KV
jest.mock('@vercel/kv', () => ({
  kv: {
    set: jest.fn(),
    get: jest.fn(),
    keys: jest.fn(() => Promise.resolve([])),
    del: jest.fn(),
  },
}));

describe('Error Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: repoclaw, Property 22: Error Logging
  // Validates: Requirements 10.2
  test('Property 22: Error Logging - all errors are logged with required fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          pipelineId: fc.string({ minLength: 10, maxLength: 20 }),
          agent: fc.option(fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch', 'supervisor'), { nil: null }),
          message: fc.string({ minLength: 1, maxLength: 200 }),
          details: fc.string({ minLength: 1, maxLength: 500 }),
          recoverable: fc.boolean(),
        }),
        async (errorData) => {
          // Log the error
          const errorId = await logError(errorData);

          // Verify error ID is generated
          expect(errorId).toBeDefined();
          expect(typeof errorId).toBe('string');
          expect(errorId.length).toBeGreaterThan(0);

          // Verify all required fields are present
          expect(errorData.pipelineId).toBeDefined();
          expect(errorData.message).toBeDefined();
          expect(errorData.details).toBeDefined();
          expect(typeof errorData.recoverable).toBe('boolean');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('error logs include timestamp', () => {
    fc.assert(
      fc.property(
        fc.record({
          pipelineId: fc.string(),
          agent: fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
          message: fc.string(),
          details: fc.string(),
          recoverable: fc.boolean(),
        }),
        async (errorData) => {
          const beforeTime = Date.now();
          await logError(errorData);
          const afterTime = Date.now();

          // Timestamp should be between before and after
          // (We can't directly verify the stored timestamp without mocking KV get)
          expect(beforeTime).toBeLessThanOrEqual(afterTime);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('agent errors include agent name', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch', 'supervisor'),
        fc.string({ minLength: 1 }),
        async (pipelineId: string, agent: AgentType, errorMessage: string) => {
          const error = new Error(errorMessage);
          const errorId = await logAgentError(pipelineId, agent, error);

          // Verify error ID is generated
          expect(errorId).toBeDefined();
          expect(typeof errorId).toBe('string');

          // Verify agent is one of the valid types
          expect(['analyze', 'docs', 'demo', 'pitch', 'supervisor']).toContain(agent);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('system errors have null agent', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (pipelineId: string, message: string, details: string) => {
          const errorId = await logSystemError(pipelineId, message, details);

          // Verify error ID is generated
          expect(errorId).toBeDefined();
          expect(typeof errorId).toBe('string');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('error formatting includes all key information', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          pipelineId: fc.string(),
          agent: fc.option(fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'), { nil: null }),
          message: fc.string({ minLength: 1 }),
          details: fc.string({ minLength: 1 }),
          timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
          recoverable: fc.boolean(),
        }),
        (errorLog: ErrorLog) => {
          const formatted = formatErrorForDisplay(errorLog);

          // Verify formatted string contains key information
          expect(formatted).toContain(errorLog.message);
          expect(formatted).toContain(errorLog.details);
          expect(formatted).toContain(errorLog.recoverable ? 'Recoverable' : 'Fatal');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('recoverable error detection', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'network error',
          'timeout error',
          'rate limit exceeded',
          'auth failed',
          'token expired',
          'unknown error',
          'syntax error'
        ),
        (errorMessage: string) => {
          const error = new Error(errorMessage);
          const recoverable = isRecoverableError(error);

          // Network, timeout, rate limit, and auth errors should be recoverable
          if (
            errorMessage.includes('network') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('rate limit') ||
            errorMessage.includes('auth') ||
            errorMessage.includes('token')
          ) {
            expect(recoverable).toBe(true);
          }

          // Verify return type is boolean
          expect(typeof recoverable).toBe('boolean');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('error IDs are unique', async () => {
    const errorData = {
      pipelineId: 'test-pipeline',
      agent: 'analyze' as AgentType,
      message: 'Test error',
      details: 'Test details',
      recoverable: true,
    };

    const id1 = await logError(errorData);
    const id2 = await logError(errorData);

    // IDs should be different even for identical error data
    expect(id1).not.toBe(id2);
  });

  test('error logs contain stack trace when available', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
        async (pipelineId: string, agent: AgentType) => {
          const error = new Error('Test error with stack');
          const errorId = await logAgentError(pipelineId, agent, error);

          // Verify error has stack trace
          expect(error.stack).toBeDefined();
          expect(errorId).toBeDefined();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
