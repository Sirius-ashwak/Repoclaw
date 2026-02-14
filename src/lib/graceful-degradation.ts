/**
 * Graceful Degradation
 * Allows pipeline to continue if optional agents fail
 */

import { AgentType, PipelineState, AgentStatus } from '@/types';
import { updatePipeline } from './kv';
import { logSystemError } from './error-logger';
import { isAgentCritical } from './mode-config';

/**
 * Check if agent is optional (can be skipped)
 */
export function isAgentOptional(agent: AgentType, mode: string): boolean {
  // Analyze and Docs are always critical
  if (agent === 'analyze' || agent === 'docs') {
    return false;
  }

  // Supervisor is always critical
  if (agent === 'supervisor') {
    return false;
  }

  // Demo and Pitch are optional based on mode
  // Use mode config to determine criticality
  return !isAgentCritical(mode as any, agent as any);
}

/**
 * Handle agent failure with graceful degradation
 */
export async function handleAgentFailure(
  pipelineId: string,
  pipeline: PipelineState,
  failedAgent: AgentType,
  error: Error
): Promise<{ shouldContinue: boolean; nextAgent: AgentType | null }> {
  const isOptional = isAgentOptional(failedAgent, pipeline.mode);

  if (isOptional) {
    // Mark agent as skipped and continue
    await logSystemError(
      pipelineId,
      `Optional agent ${failedAgent} failed, continuing pipeline`,
      error.message,
      true
    );

    // Update agent status to skipped
    const updatedResults = {
      ...pipeline.agentResults,
      [failedAgent]: {
        agent: failedAgent,
        status: 'skipped' as AgentStatus,
        artifacts: [],
        error: error.message,
        executionTime: 0,
        metadata: { skipped: true, reason: error.message },
      },
    };

    await updatePipeline(pipelineId, {
      agentResults: updatedResults,
      timestamps: {
        ...pipeline.timestamps,
        [`${failedAgent}_skipped`]: Date.now(),
      },
    });

    // Determine next agent
    const nextAgent = getNextAgent(failedAgent);
    return { shouldContinue: true, nextAgent };
  } else {
    // Critical agent failed, halt pipeline
    await logSystemError(
      pipelineId,
      `Critical agent ${failedAgent} failed, halting pipeline`,
      error.message,
      true
    );

    await updatePipeline(pipelineId, {
      status: 'failed',
      error: {
        agent: failedAgent,
        message: error.message,
        details: error.stack || error.toString(),
        timestamp: Date.now(),
        recoverable: true,
      },
      timestamps: {
        ...pipeline.timestamps,
        failed: Date.now(),
      },
    });

    return { shouldContinue: false, nextAgent: null };
  }
}

/**
 * Get next agent in sequence
 */
export function getNextAgent(currentAgent: AgentType): AgentType | null {
  const agentSequence: AgentType[] = ['analyze', 'docs', 'demo', 'pitch', 'supervisor'];
  const currentIndex = agentSequence.indexOf(currentAgent);

  if (currentIndex === -1 || currentIndex === agentSequence.length - 1) {
    return null;
  }

  return agentSequence[currentIndex + 1];
}

/**
 * Check if pipeline can continue with skipped agents
 */
export function canContinueWithSkippedAgents(pipeline: PipelineState): boolean {
  // Check if any critical agents failed
  const criticalAgents: AgentType[] = ['analyze', 'docs', 'supervisor'];

  for (const agent of criticalAgents) {
    const result = pipeline.agentResults[agent];
    if (result && (result.status === 'failed' || result.status === 'skipped')) {
      return false;
    }
  }

  return true;
}

/**
 * Get skipped agents summary
 */
export function getSkippedAgentsSummary(pipeline: PipelineState): {
  skippedAgents: AgentType[];
  skippedCount: number;
  reasons: Record<AgentType, string>;
} {
  const skippedAgents: AgentType[] = [];
  const reasons: Record<AgentType, string> = {} as any;

  for (const [agent, result] of Object.entries(pipeline.agentResults)) {
    if (result && result.status === 'skipped') {
      skippedAgents.push(agent as AgentType);
      reasons[agent as AgentType] = result.error || 'Unknown reason';
    }
  }

  return {
    skippedAgents,
    skippedCount: skippedAgents.length,
    reasons,
  };
}

/**
 * Create warning message for skipped agents
 */
export function createSkippedAgentsWarning(pipeline: PipelineState): string | null {
  const summary = getSkippedAgentsSummary(pipeline);

  if (summary.skippedCount === 0) {
    return null;
  }

  const agentNames = summary.skippedAgents.map((agent) => agent.toUpperCase()).join(', ');
  return `Warning: ${summary.skippedCount} optional agent(s) were skipped: ${agentNames}. The pipeline continued with available agents.`;
}

/**
 * Determine if pipeline should fail fast or continue
 */
export function shouldFailFast(agent: AgentType, mode: string): boolean {
  // Always fail fast for critical agents
  if (agent === 'analyze' || agent === 'docs' || agent === 'supervisor') {
    return true;
  }

  // For optional agents, check mode configuration
  return isAgentCritical(mode as any, agent as any);
}

/**
 * Get completion status with degradation info
 */
export interface CompletionStatus {
  status: 'full' | 'partial' | 'failed';
  completedAgents: AgentType[];
  skippedAgents: AgentType[];
  failedAgents: AgentType[];
  message: string;
}

export function getCompletionStatus(pipeline: PipelineState): CompletionStatus {
  const completedAgents: AgentType[] = [];
  const skippedAgents: AgentType[] = [];
  const failedAgents: AgentType[] = [];

  for (const [agent, result] of Object.entries(pipeline.agentResults)) {
    if (result) {
      if (result.status === 'completed') {
        completedAgents.push(agent as AgentType);
      } else if (result.status === 'skipped') {
        skippedAgents.push(agent as AgentType);
      } else if (result.status === 'failed') {
        failedAgents.push(agent as AgentType);
      }
    }
  }

  let status: 'full' | 'partial' | 'failed';
  let message: string;

  if (failedAgents.length > 0) {
    status = 'failed';
    message = `Pipeline failed at ${failedAgents[0].toUpperCase()} agent`;
  } else if (skippedAgents.length > 0) {
    status = 'partial';
    message = `Pipeline completed with ${skippedAgents.length} optional agent(s) skipped`;
  } else {
    status = 'full';
    message = 'Pipeline completed successfully';
  }

  return {
    status,
    completedAgents,
    skippedAgents,
    failedAgents,
    message,
  };
}
