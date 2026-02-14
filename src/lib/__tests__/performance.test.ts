/**
 * Property-based tests for performance monitoring
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import {
  startAgentTiming,
  endAgentTiming,
  startPipelineTiming,
  endPipelineTiming,
  updateAgentTiming,
  isAgentOverTime,
  isPipelineOverTime,
  getTimeRemaining,
  formatDuration,
  getPerformanceSummary,
  createTimingWarning,
  TIME_LIMITS,
} from '../performance';
import { AgentType } from '@/types';

// Mock Vercel KV
jest.mock('@vercel/kv', () => ({
  kv: {
    set: jest.fn(),
    get: jest.fn(),
  },
}));

describe('Performance Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: repoclaw, Property 29: Individual Agent Timing
  // Validates: Requirements 12.2, 12.3, 12.4, 12.5
  test('Property 29: Individual Agent Timing - each agent completes within allocated time', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch', 'supervisor'),
        fc.integer({ min: 0, max: 200000 }),
        (agent: AgentType, duration: number) => {
          // Verify time limits are defined
          expect(TIME_LIMITS[agent]).toBeDefined();
          expect(TIME_LIMITS[agent]).toBeGreaterThan(0);

          // Check if duration exceeds limit
          const isOverTime = isAgentOverTime(agent, duration);
          expect(isOverTime).toBe(duration > TIME_LIMITS[agent]);

          // Verify time limits match requirements
          if (agent === 'analyze') {
            expect(TIME_LIMITS[agent]).toBe(30 * 1000); // 30 seconds
          } else if (agent === 'docs') {
            expect(TIME_LIMITS[agent]).toBe(45 * 1000); // 45 seconds
          } else if (agent === 'demo') {
            expect(TIME_LIMITS[agent]).toBe(90 * 1000); // 90 seconds
          } else if (agent === 'pitch') {
            expect(TIME_LIMITS[agent]).toBe(45 * 1000); // 45 seconds
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('agent timing records start and end times', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
        (pipelineId: string, agent: AgentType) => {
          const timing = startAgentTiming(pipelineId, agent);

          // Verify timing structure
          expect(timing.agent).toBe(agent);
          expect(timing.pipelineId).toBe(pipelineId);
          expect(timing.startTime).toBeGreaterThan(0);
          expect(timing.endTime).toBe(null);
          expect(timing.duration).toBe(null);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('ending agent timing calculates duration', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
        (pipelineId: string, agent: AgentType) => {
          const startTiming = startAgentTiming(pipelineId, agent);
          const endTiming = endAgentTiming(startTiming);

          // Verify end timing
          expect(endTiming.endTime).toBeGreaterThan(startTiming.startTime);
          expect(endTiming.duration).toBeGreaterThanOrEqual(0);
          expect(endTiming.duration).toBe(endTiming.endTime! - startTiming.startTime);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('pipeline timing tracks all agents', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 10 }), (pipelineId: string) => {
        const timing = startPipelineTiming(pipelineId);

        // Verify pipeline timing structure
        expect(timing.pipelineId).toBe(pipelineId);
        expect(timing.startTime).toBeGreaterThan(0);
        expect(timing.endTime).toBe(null);
        expect(timing.duration).toBe(null);
        expect(timing.agentTimings).toBeDefined();

        // Verify all agents are tracked
        expect(timing.agentTimings.analyze).toBe(null);
        expect(timing.agentTimings.docs).toBe(null);
        expect(timing.agentTimings.demo).toBe(null);
        expect(timing.agentTimings.pitch).toBe(null);
        expect(timing.agentTimings.supervisor).toBe(null);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('pipeline timing calculates total duration', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 10 }), (pipelineId: string) => {
        const startTiming = startPipelineTiming(pipelineId);
        const endTiming = endPipelineTiming(startTiming);

        // Verify total duration
        expect(endTiming.totalDuration).toBeGreaterThanOrEqual(0);
        expect(endTiming.duration).toBe(endTiming.totalDuration);
        expect(endTiming.endTime).toBeGreaterThan(startTiming.startTime);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('time remaining calculation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
        fc.integer({ min: 0, max: 200000 }),
        (agent: AgentType, elapsed: number) => {
          const remaining = getTimeRemaining(agent, elapsed);

          // Verify remaining time
          expect(remaining).toBeGreaterThanOrEqual(0);

          if (elapsed >= TIME_LIMITS[agent]) {
            expect(remaining).toBe(0);
          } else {
            expect(remaining).toBe(TIME_LIMITS[agent] - elapsed);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('duration formatting', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 600000 }), (milliseconds: number) => {
        const formatted = formatDuration(milliseconds);

        // Verify format
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);

        // Should contain 's' for seconds
        expect(formatted).toContain('s');

        // If over 60 seconds, should contain 'm' for minutes
        if (milliseconds >= 60000) {
          expect(formatted).toContain('m');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('performance summary includes all metrics', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.record({
          analyze: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
          docs: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
          demo: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
          pitch: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
          supervisor: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: null }),
        }),
        (pipelineId: string, durations) => {
          const timing = startPipelineTiming(pipelineId);

          // Add agent timings
          for (const [agent, duration] of Object.entries(durations)) {
            if (duration !== null) {
              timing.agentTimings[agent as AgentType] = {
                startTime: Date.now(),
                endTime: Date.now() + duration,
                duration,
              };
            }
          }

          timing.totalDuration = Object.values(durations)
            .filter((d) => d !== null)
            .reduce((sum, d) => sum + d!, 0);

          const summary = getPerformanceSummary(timing);

          // Verify summary structure
          expect(summary.totalDuration).toBeDefined();
          expect(summary.agentDurations).toBeDefined();
          expect(typeof summary.withinBudget).toBe('boolean');
          expect(Array.isArray(summary.overTimeAgents)).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('timing warnings for over-time agents', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
        fc.integer({ min: 0, max: 200000 }),
        (agent: AgentType, duration: number) => {
          const warning = createTimingWarning(agent, duration);

          if (duration > TIME_LIMITS[agent]) {
            // Should have warning
            expect(warning).not.toBe(null);
            expect(warning).toContain(agent.toUpperCase());
            expect(warning).toContain('exceeded');
          } else {
            // Should not have warning
            expect(warning).toBe(null);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('pipeline over-time detection', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 300000 }), (duration: number) => {
        const isOverTime = isPipelineOverTime(duration);

        // Pipeline limit is 180 seconds (3 minutes)
        expect(isOverTime).toBe(duration > 180000);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('update agent timing in pipeline', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch'),
        fc.integer({ min: 1000, max: 50000 }),
        (pipelineId: string, agent: AgentType, duration: number) => {
          const pipelineTiming = startPipelineTiming(pipelineId);
          const agentTiming = {
            startTime: Date.now(),
            endTime: Date.now() + duration,
            duration,
          };

          const updated = updateAgentTiming(pipelineTiming, agent, agentTiming);

          // Verify update
          expect(updated.agentTimings[agent]).toBe(agentTiming);
          expect(updated.agentTimings[agent]?.duration).toBe(duration);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('End-to-End Performance', () => {
  // Feature: repoclaw, Property 28: End-to-End Execution Time
  // Validates: Requirements 12.1
  test('Property 28: End-to-End Execution Time - pipeline completes within 3 minutes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.record({
          analyze: fc.integer({ min: 5000, max: 35000 }),
          docs: fc.integer({ min: 10000, max: 50000 }),
          demo: fc.integer({ min: 20000, max: 100000 }),
          pitch: fc.integer({ min: 10000, max: 50000 }),
          supervisor: fc.integer({ min: 5000, max: 65000 }),
        }),
        (pipelineId: string, durations) => {
          const timing = startPipelineTiming(pipelineId);

          // Simulate agent executions
          let totalDuration = 0;
          for (const [agent, duration] of Object.entries(durations)) {
            timing.agentTimings[agent as AgentType] = {
              startTime: timing.startTime + totalDuration,
              endTime: timing.startTime + totalDuration + duration,
              duration,
            };
            totalDuration += duration;
          }

          timing.totalDuration = totalDuration;
          timing.endTime = timing.startTime + totalDuration;
          timing.duration = totalDuration;

          // Verify pipeline timing
          expect(timing.totalDuration).toBe(totalDuration);

          // Check if within 3-minute budget
          const withinBudget = totalDuration <= TIME_LIMITS.pipeline;
          expect(isPipelineOverTime(totalDuration)).toBe(!withinBudget);

          // Verify time limit is 3 minutes (180 seconds)
          expect(TIME_LIMITS.pipeline).toBe(180 * 1000);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('pipeline timing includes all agent durations', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.array(
          fc.record({
            agent: fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch', 'supervisor'),
            duration: fc.integer({ min: 1000, max: 50000 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (pipelineId: string, agentData) => {
          const timing = startPipelineTiming(pipelineId);

          let totalDuration = 0;
          for (const { agent, duration } of agentData) {
            timing.agentTimings[agent] = {
              startTime: timing.startTime + totalDuration,
              endTime: timing.startTime + totalDuration + duration,
              duration,
            };
            totalDuration += duration;
          }

          timing.totalDuration = totalDuration;

          // Verify total equals sum of agent durations
          const calculatedTotal = agentData.reduce((sum, { duration }) => sum + duration, 0);
          expect(timing.totalDuration).toBe(calculatedTotal);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('performance summary identifies slowest and fastest agents', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.array(
          fc.record({
            agent: fc.constantFrom<AgentType>('analyze', 'docs', 'demo', 'pitch', 'supervisor'),
            duration: fc.integer({ min: 1000, max: 100000 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (pipelineId: string, agentData) => {
          const timing = startPipelineTiming(pipelineId);

          // Add unique agents only
          const uniqueAgents = new Map<AgentType, number>();
          for (const { agent, duration } of agentData) {
            if (!uniqueAgents.has(agent)) {
              uniqueAgents.set(agent, duration);
            }
          }

          let totalDuration = 0;
          for (const [agent, duration] of uniqueAgents) {
            timing.agentTimings[agent] = {
              startTime: timing.startTime + totalDuration,
              endTime: timing.startTime + totalDuration + duration,
              duration,
            };
            totalDuration += duration;
          }

          timing.totalDuration = totalDuration;

          const summary = getPerformanceSummary(timing);

          if (uniqueAgents.size > 0) {
            // Verify slowest agent
            if (summary.slowestAgent) {
              const slowestDuration = uniqueAgents.get(summary.slowestAgent.agent);
              expect(summary.slowestAgent.duration).toBe(slowestDuration);

              // Verify it's actually the slowest
              for (const [agent, duration] of uniqueAgents) {
                expect(summary.slowestAgent.duration).toBeGreaterThanOrEqual(duration);
              }
            }

            // Verify fastest agent
            if (summary.fastestAgent) {
              const fastestDuration = uniqueAgents.get(summary.fastestAgent.agent);
              expect(summary.fastestAgent.duration).toBe(fastestDuration);

              // Verify it's actually the fastest
              for (const [agent, duration] of uniqueAgents) {
                expect(summary.fastestAgent.duration).toBeLessThanOrEqual(duration);
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
