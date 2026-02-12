/**
 * Configuration for RepoClaw modes and agent settings
 */

import type { Mode, ModeConfig } from '@/types';

export const MODE_CONFIGS: Record<Mode, ModeConfig> = {
  hackathon: {
    mode: 'hackathon',
    agentPriorities: {
      analyze: 1,
      docs: 2,
      demo: 3, // Highest priority
      pitch: 3, // Highest priority
    },
    llmPromptModifiers: {
      emphasis: 'innovation and demo appeal',
      tone: 'exciting and energetic',
      focus: [
        'Quick setup and deployment',
        'Visual appeal and user experience',
        'Innovative features and uniqueness',
        'Demo-ready presentation',
      ],
    },
  },
  placement: {
    mode: 'placement',
    agentPriorities: {
      analyze: 2,
      docs: 3, // Highest priority
      demo: 2,
      pitch: 1,
    },
    llmPromptModifiers: {
      emphasis: 'technical depth and best practices',
      tone: 'professional and detailed',
      focus: [
        'Comprehensive documentation',
        'Code quality and architecture',
        'Testing and reliability',
        'Professional presentation',
      ],
    },
  },
  refactor: {
    mode: 'refactor',
    agentPriorities: {
      analyze: 3, // Highest priority
      docs: 2,
      demo: 1,
      pitch: 1,
    },
    llmPromptModifiers: {
      emphasis: 'code improvements and maintainability',
      tone: 'technical and constructive',
      focus: [
        'Code structure and organization',
        'Performance optimizations',
        'Best practices and patterns',
        'Technical debt reduction',
      ],
    },
  },
};

export const AGENT_TIMEOUTS = {
  analyze: 30 * 1000, // 30 seconds
  docs: 45 * 1000, // 45 seconds
  demo: 90 * 1000, // 90 seconds
  pitch: 45 * 1000, // 45 seconds
  supervisor: 180 * 1000, // 3 minutes
};

export const PIPELINE_TIMEOUT = 180 * 1000; // 3 minutes total

export const SUPPORTED_STACKS = ['node', 'nodejs', 'next', 'nextjs', 'react'];

export const API_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 4000,
};

export const SSE_HEARTBEAT_INTERVAL = 15 * 1000; // 15 seconds

export function getModeConfig(mode: Mode): ModeConfig {
  return MODE_CONFIGS[mode];
}

export function getAgentTimeout(agent: string): number {
  return AGENT_TIMEOUTS[agent as keyof typeof AGENT_TIMEOUTS] || 60 * 1000;
}

export function isStackSupported(stack: string): boolean {
  return SUPPORTED_STACKS.some(supported => 
    stack.toLowerCase().includes(supported)
  );
}
