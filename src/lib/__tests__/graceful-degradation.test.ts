/**
 * Unit tests for graceful degradation
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  isAgentOptional,
  getNextAgent,
  canContinueWithSkippedAgents,
  getSkippedAgentsSummary,
  createSkippedAgentsWarning,
  shouldFailFast,
  getCompletionStatus,
} from '../graceful-degradation';
import { AgentType, PipelineState, AgentStatus } from '@/types';

// Mock dependencies
jest.mock('../kv', () => ({
  updatePipeline: jest.fn(),
}));

jest.mock('../error-logger', () => ({
  logSystemError: jest.fn(),
}));

jest.mock('../mode-config', () => ({
  isAgentCritical: jest.fn((mode: string, agent: string) => {
    // Hackathon: demo and pitch are critical
    if (mode === 'hackathon') {
      return agent === 'demo' || agent === 'pitch';
    }
    // Placement: docs is critical
    if (mode === 'placement') {
      return agent === 'docs';
    }
    // Refactor: analyze is critical
    if (mode === 'refactor') {
      return agent === 'analyze';
    }
    return false;
  }),
}));

describe('Graceful Degradation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('analyze agent is never optional', () => {
    expect(isAgentOptional('analyze', 'hackathon')).toBe(false);
    expect(isAgentOptional('analyze', 'placement')).toBe(false);
    expect(isAgentOptional('analyze', 'refactor')).toBe(false);
  });

  test('docs agent is never optional', () => {
    expect(isAgentOptional('docs', 'hackathon')).toBe(false);
    expect(isAgentOptional('docs', 'placement')).toBe(false);
    expect(isAgentOptional('docs', 'refactor')).toBe(false);
  });

  test('supervisor agent is never optional', () => {
    expect(isAgentOptional('supervisor', 'hackathon')).toBe(false);
    expect(isAgentOptional('supervisor', 'placement')).toBe(false);
    expect(isAgentOptional('supervisor', 'refactor')).toBe(false);
  });

  test('demo and pitch agents are optional based on mode', () => {
    // In hackathon mode, demo and pitch are critical (not optional)
    expect(isAgentOptional('demo', 'hackathon')).toBe(false);
    expect(isAgentOptional('pitch', 'hackathon')).toBe(false);

    // In placement mode, demo and pitch are optional
    expect(isAgentOptional('demo', 'placement')).toBe(true);
    expect(isAgentOptional('pitch', 'placement')).toBe(true);
  });

  test('getNextAgent returns correct sequence', () => {
    expect(getNextAgent('analyze')).toBe('docs');
    expect(getNextAgent('docs')).toBe('demo');
    expect(getNextAgent('demo')).toBe('pitch');
    expect(getNextAgent('pitch')).toBe('supervisor');
    expect(getNextAgent('supervisor')).toBe(null);
  });

  test('canContinueWithSkippedAgents checks critical agents', () => {
    const pipelineWithSkippedDemo: Partial<PipelineState> = {
      id: 'test',
      sessionId: 'test',
      mode: 'placement',
      status: 'running',
      agentResults: {
        analyze: {
          agent: 'analyze',
          status: 'completed',
          artifacts: [],
          error: null,
          executionTime: 1000,
          metadata: {},
        },
        docs: {
          agent: 'docs',
          status: 'completed',
          artifacts: [],
          error: null,
          executionTime: 1000,
          metadata: {},
        },
        demo: {
          agent: 'demo',
          status: 'skipped',
          artifacts: [],
          error: 'Deployment failed',
          executionTime: 0,
          metadata: {},
        },
        pitch: null,
        supervisor: null,
      },
      startedAt: Date.now(),
    };

    expect(canContinueWithSkippedAgents(pipelineWithSkippedDemo as PipelineState)).toBe(true);
  });

  test('canContinueWithSkippedAgents fails for critical agents', () => {
    const pipelineWithFailedDocs: Partial<PipelineState> = {
      id: 'test',
      sessionId: 'test',
      mode: 'placement',
      status: 'failed',
      agentResults: {
        analyze: {
          agent: 'analyze',
          status: 'completed',
          artifacts: [],
          error: null,
          executionTime: 1000,
          metadata: {},
        },
        docs: {
          agent: 'docs',
          status: 'failed',
          artifacts: [],
          error: 'Generation failed',
          executionTime: 1000,
          metadata: {},
        },
        demo: null,
        pitch: null,
        supervisor: null,
      },
      startedAt: Date.now(),
    };

    expect(canContinueWithSkippedAgents(pipelineWithFailedDocs as PipelineState)).toBe(false);
  });

  test('getSkippedAgentsSummary returns correct data', () => {
    const pipeline: Partial<PipelineState> = {
      id: 'test',
      sessionId: 'test',
      mode: 'placement',
      status: 'completed',
      agentResults: {
        analyze: {
          agent: 'analyze',
          status: 'completed',
          artifacts: [],
          error: null,
          executionTime: 1000,
          metadata: {},
        },
        docs: {
          agent: 'docs',
          status: 'completed',
          artifacts: [],
          error: null,
          executionTime: 1000,
          metadata: {},
        },
        demo: {
          agent: 'demo',
          status: 'skipped',
          artifacts: [],
          error: 'Deployment failed',
          executionTime: 0,
          metadata: {},
        },
        pitch: {
          agent: 'pitch',
          status: 'skipped',
          artifacts: [],
          error: 'LLM unavailable',
          executionTime: 0,
          metadata: {},
        },
        supervisor: {
          agent: 'supervisor',
          status: 'completed',
          artifacts: [],
          error: null,
          executionTime: 1000,
          metadata: {},
        },
      },
      startedAt: Date.now(),
    };

    const summary = getSkippedAgentsSummary(pipeline as PipelineState);

    expect(summary.skippedCount).toBe(2);
    expect(summary.skippedAgents).toContain('demo');
    expect(summary.skippedAgents).toContain('pitch');
    expect(summary.reasons.demo).toBe('Deployment failed');
    expect(summary.reasons.pitch).toBe('LLM unavailable');
  });

  test('createSkippedAgentsWarning generates correct message', () => {
    const pipeline: Partial<PipelineState> = {
      id: 'test',
      sessionId: 'test',
      mode: 'placement',
      status: 'completed',
      agentResults: {
        analyze: { agent: 'analyze', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
        docs: { agent: 'docs', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
        demo: { agent: 'demo', status: 'skipped', artifacts: [], error: 'Failed', executionTime: 0, metadata: {} },
        pitch: null,
        supervisor: { agent: 'supervisor', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
      },
      startedAt: Date.now(),
    };

    const warning = createSkippedAgentsWarning(pipeline as PipelineState);

    expect(warning).toContain('1 optional agent(s) were skipped');
    expect(warning).toContain('DEMO');
  });

  test('shouldFailFast returns true for critical agents', () => {
    expect(shouldFailFast('analyze', 'hackathon')).toBe(true);
    expect(shouldFailFast('docs', 'hackathon')).toBe(true);
    expect(shouldFailFast('supervisor', 'hackathon')).toBe(true);
  });

  test('getCompletionStatus returns full completion', () => {
    const pipeline: Partial<PipelineState> = {
      id: 'test',
      sessionId: 'test',
      mode: 'hackathon',
      status: 'completed',
      agentResults: {
        analyze: { agent: 'analyze', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
        docs: { agent: 'docs', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
        demo: { agent: 'demo', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
        pitch: { agent: 'pitch', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
        supervisor: { agent: 'supervisor', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
      },
      startedAt: Date.now(),
    };

    const status = getCompletionStatus(pipeline as PipelineState);

    expect(status.status).toBe('full');
    expect(status.completedAgents.length).toBe(5);
    expect(status.skippedAgents.length).toBe(0);
    expect(status.failedAgents.length).toBe(0);
    expect(status.message).toContain('successfully');
  });

  test('getCompletionStatus returns partial completion', () => {
    const pipeline: Partial<PipelineState> = {
      id: 'test',
      sessionId: 'test',
      mode: 'placement',
      status: 'completed',
      agentResults: {
        analyze: { agent: 'analyze', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
        docs: { agent: 'docs', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
        demo: { agent: 'demo', status: 'skipped', artifacts: [], error: 'Failed', executionTime: 0, metadata: {} },
        pitch: null,
        supervisor: { agent: 'supervisor', status: 'completed', artifacts: [], error: null, executionTime: 1000, metadata: {} },
      },
      startedAt: Date.now(),
    };

    const status = getCompletionStatus(pipeline as PipelineState);

    expect(status.status).toBe('partial');
    expect(status.skippedAgents.length).toBe(1);
    expect(status.message).toContain('skipped');
  });
});
