/**
 * Mode Configuration System
 * Defines mode-specific agent priorities and LLM prompt modifiers
 */

import { Mode, ModeConfig } from '@/types';

/**
 * Mode configurations for Hackathon, Placement, and Refactor modes
 * Each mode has different priorities and emphasis
 */
export const MODE_CONFIGS: Record<Mode, ModeConfig> = {
  hackathon: {
    mode: 'hackathon',
    agentPriorities: {
      analyze: 1,
      docs: 2,
      demo: 4, // Highest priority - demo is critical for hackathons
      pitch: 3, // High priority - pitch materials are important
    },
    llmPromptModifiers: {
      emphasis: 'innovation and demo appeal',
      tone: 'exciting and engaging',
      focus: [
        'Highlight unique features and innovation',
        'Emphasize live demo and user experience',
        'Create compelling pitch materials',
        'Focus on visual appeal and wow factor',
        'Include quick start instructions',
      ],
    },
  },
  placement: {
    mode: 'placement',
    agentPriorities: {
      analyze: 2,
      docs: 4, // Highest priority - documentation is critical for placements
      demo: 2,
      pitch: 3, // High priority - professional presentation matters
    },
    llmPromptModifiers: {
      emphasis: 'technical depth and best practices',
      tone: 'professional and detailed',
      focus: [
        'Comprehensive documentation with examples',
        'Highlight technical architecture and design patterns',
        'Emphasize code quality and testing',
        'Include detailed API documentation',
        'Showcase problem-solving approach',
      ],
    },
  },
  refactor: {
    mode: 'refactor',
    agentPriorities: {
      analyze: 4, // Highest priority - analysis drives refactoring
      docs: 3, // High priority - updated docs are important
      demo: 1, // Lower priority - demo is optional for refactoring
      pitch: 1, // Lower priority - pitch is optional for refactoring
    },
    llmPromptModifiers: {
      emphasis: 'code improvements and maintainability',
      tone: 'technical and actionable',
      focus: [
        'Identify code structure improvements',
        'Suggest refactoring opportunities',
        'Highlight technical debt',
        'Recommend best practices',
        'Focus on code quality and maintainability',
      ],
    },
  },
};

/**
 * Get mode configuration for a specific mode
 */
export function getModeConfig(mode: Mode): ModeConfig {
  return MODE_CONFIGS[mode];
}

/**
 * Get agent priority for a specific mode and agent
 * Higher number = higher priority
 */
export function getAgentPriority(mode: Mode, agent: keyof ModeConfig['agentPriorities']): number {
  return MODE_CONFIGS[mode].agentPriorities[agent];
}

/**
 * Check if an agent is critical for a specific mode
 * Critical agents have priority >= 3
 */
export function isAgentCritical(mode: Mode, agent: keyof ModeConfig['agentPriorities']): boolean {
  return getAgentPriority(mode, agent) >= 3;
}

/**
 * Get LLM prompt modifier for a specific mode
 * Returns a formatted string to append to LLM prompts
 */
export function getLLMPromptModifier(mode: Mode): string {
  const config = MODE_CONFIGS[mode];
  const focusPoints = config.llmPromptModifiers.focus.map((point, idx) => `${idx + 1}. ${point}`).join('\n');
  
  return `
Mode: ${mode.toUpperCase()}
Emphasis: ${config.llmPromptModifiers.emphasis}
Tone: ${config.llmPromptModifiers.tone}

Focus Areas:
${focusPoints}
`;
}

/**
 * Get mode description for UI display
 */
export function getModeDescription(mode: Mode): string {
  const descriptions: Record<Mode, string> = {
    hackathon: 'Optimize for hackathon presentations with focus on demo and pitch materials',
    placement: 'Optimize for job placements with comprehensive documentation and professional presentation',
    refactor: 'Optimize for code improvements with focus on analysis and maintainability',
  };
  return descriptions[mode];
}

/**
 * Get mode display name
 */
export function getModeDisplayName(mode: Mode): string {
  const displayNames: Record<Mode, string> = {
    hackathon: 'Hackathon',
    placement: 'Placement',
    refactor: 'Refactor',
  };
  return displayNames[mode];
}

/**
 * Validate mode string
 */
export function isValidMode(mode: string): mode is Mode {
  return ['hackathon', 'placement', 'refactor'].includes(mode);
}
