/**
 * Performance Monitoring and Timing
 * Records and tracks execution times for agents and pipeline
 */

import { AgentType } from '@/types';
import { kv } from '@vercel/kv';

export interface TimingData {
  startTime: number;
  endTime: number | null;
  duration: number | null;
}

export interface AgentTiming extends TimingData {
  agent: AgentType;
  pipelineId: string;
}

export interface PipelineTiming extends TimingData {
  pipelineId: string;
  agentTimings: Record<AgentType, TimingData | null>;
  totalDuration: number | null;
}

const TIMING_PREFIX = 'timing:';
const TIMING_TTL = 60 * 60 * 24 * 7; // 7 days

// Time limits (in milliseconds)
export const TIME_LIMITS = {
  analyze: 30 * 1000, // 30 seconds
  docs: 45 * 1000, // 45 seconds
  demo: 90 * 1000, // 90 seconds
  pitch: 45 * 1000, // 45 seconds
  supervisor: 60 * 1000, // 60 seconds
  pipeline: 180 * 1000, // 3 minutes
};

/**
 * Start timing for an agent
 */
export function startAgentTiming(pipelineId: string, agent: AgentType): AgentTiming {
  return {
    agent,
    pipelineId,
    startTime: Date.now(),
    endTime: null,
    duration: null,
  };
}

/**
 * End timing for an agent
 */
export function endAgentTiming(timing: AgentTiming): AgentTiming {
  const endTime = Date.now();
  return {
    ...timing,
    endTime,
    duration: endTime - timing.startTime,
  };
}

/**
 * Start timing for pipeline
 */
export function startPipelineTiming(pipelineId: string): PipelineTiming {
  return {
    pipelineId,
    startTime: Date.now(),
    endTime: null,
    duration: null,
    agentTimings: {
      analyze: null,
      docs: null,
      demo: null,
      pitch: null,
      supervisor: null,
    },
    totalDuration: null,
  };
}

/**
 * End timing for pipeline
 */
export function endPipelineTiming(timing: PipelineTiming): PipelineTiming {
  const endTime = Date.now();
  return {
    ...timing,
    endTime,
    duration: endTime - timing.startTime,
    totalDuration: endTime - timing.startTime,
  };
}

/**
 * Update agent timing in pipeline timing
 */
export function updateAgentTiming(
  pipelineTiming: PipelineTiming,
  agent: AgentType,
  agentTiming: TimingData
): PipelineTiming {
  return {
    ...pipelineTiming,
    agentTimings: {
      ...pipelineTiming.agentTimings,
      [agent]: agentTiming,
    },
  };
}

/**
 * Save timing data to KV
 */
export async function saveTimingData(timing: PipelineTiming): Promise<void> {
  const key = `${TIMING_PREFIX}${timing.pipelineId}`;
  await kv.set(key, timing, { ex: TIMING_TTL });
}

/**
 * Get timing data from KV
 */
export async function getTimingData(pipelineId: string): Promise<PipelineTiming | null> {
  const key = `${TIMING_PREFIX}${pipelineId}`;
  return await kv.get<PipelineTiming>(key);
}

/**
 * Check if agent exceeded time limit
 */
export function isAgentOverTime(agent: AgentType, duration: number): boolean {
  return duration > TIME_LIMITS[agent];
}

/**
 * Check if pipeline exceeded time limit
 */
export function isPipelineOverTime(duration: number): boolean {
  return duration > TIME_LIMITS.pipeline;
}

/**
 * Get time remaining for agent
 */
export function getTimeRemaining(agent: AgentType, elapsed: number): number {
  return Math.max(0, TIME_LIMITS[agent] - elapsed);
}

/**
 * Format duration for display
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Get performance summary
 */
export interface PerformanceSummary {
  totalDuration: number;
  agentDurations: Record<AgentType, number | null>;
  slowestAgent: { agent: AgentType; duration: number } | null;
  fastestAgent: { agent: AgentType; duration: number } | null;
  overTimeAgents: AgentType[];
  withinBudget: boolean;
}

export function getPerformanceSummary(timing: PipelineTiming): PerformanceSummary {
  const agentDurations: Record<AgentType, number | null> = {
    analyze: timing.agentTimings.analyze?.duration || null,
    docs: timing.agentTimings.docs?.duration || null,
    demo: timing.agentTimings.demo?.duration || null,
    pitch: timing.agentTimings.pitch?.duration || null,
    supervisor: timing.agentTimings.supervisor?.duration || null,
  };

  let slowestAgent: { agent: AgentType; duration: number } | null = null;
  let fastestAgent: { agent: AgentType; duration: number } | null = null;
  const overTimeAgents: AgentType[] = [];

  for (const [agent, duration] of Object.entries(agentDurations)) {
    if (duration !== null) {
      const agentType = agent as AgentType;

      // Check if over time
      if (isAgentOverTime(agentType, duration)) {
        overTimeAgents.push(agentType);
      }

      // Track slowest
      if (!slowestAgent || duration > slowestAgent.duration) {
        slowestAgent = { agent: agentType, duration };
      }

      // Track fastest
      if (!fastestAgent || duration < fastestAgent.duration) {
        fastestAgent = { agent: agentType, duration };
      }
    }
  }

  return {
    totalDuration: timing.totalDuration || 0,
    agentDurations,
    slowestAgent,
    fastestAgent,
    overTimeAgents,
    withinBudget: !isPipelineOverTime(timing.totalDuration || 0),
  };
}

/**
 * Create timing warning message
 */
export function createTimingWarning(agent: AgentType, duration: number): string | null {
  if (isAgentOverTime(agent, duration)) {
    const limit = formatDuration(TIME_LIMITS[agent]);
    const actual = formatDuration(duration);
    return `⚠️ ${agent.toUpperCase()} agent exceeded time limit: ${actual} (limit: ${limit})`;
  }
  return null;
}

/**
 * Create pipeline timing warning
 */
export function createPipelineTimingWarning(duration: number): string | null {
  if (isPipelineOverTime(duration)) {
    const limit = formatDuration(TIME_LIMITS.pipeline);
    const actual = formatDuration(duration);
    return `⚠️ Pipeline exceeded time limit: ${actual} (limit: ${limit})`;
  }
  return null;
}

/**
 * Calculate estimated completion time
 */
export function estimateCompletionTime(
  timing: PipelineTiming,
  currentAgent: AgentType | null
): number | null {
  if (!currentAgent) {
    return null;
  }

  const agentSequence: AgentType[] = ['analyze', 'docs', 'demo', 'pitch', 'supervisor'];
  const currentIndex = agentSequence.indexOf(currentAgent);

  if (currentIndex === -1) {
    return null;
  }

  let estimatedTime = timing.startTime;

  // Add completed agent times
  for (let i = 0; i <= currentIndex; i++) {
    const agent = agentSequence[i];
    const agentTiming = timing.agentTimings[agent];
    if (agentTiming?.duration) {
      estimatedTime += agentTiming.duration;
    } else {
      // Use time limit as estimate for incomplete agents
      estimatedTime += TIME_LIMITS[agent];
    }
  }

  // Add estimated time for remaining agents
  for (let i = currentIndex + 1; i < agentSequence.length; i++) {
    const agent = agentSequence[i];
    estimatedTime += TIME_LIMITS[agent];
  }

  return estimatedTime;
}
