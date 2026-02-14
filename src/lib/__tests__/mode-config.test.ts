/**
 * Property-based tests for mode configuration system
 */

import { describe, test, expect } from '@jest/globals';
import * as fc from 'fast-check';
import {
  getModeConfig,
  getAgentPriority,
  isAgentCritical,
  getLLMPromptModifier,
  getModeDescription,
  getModeDisplayName,
  isValidMode,
  MODE_CONFIGS,
} from '../mode-config';
import { Mode } from '@/types';

describe('Mode Configuration System', () => {
  // Feature: repoclaw, Property 7: Mode Configuration
  // Validates: Requirements 3.2, 3.3, 3.4
  test('Property 7: Mode Configuration - each mode has correct priorities and emphasis', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Mode>('hackathon', 'placement', 'refactor'),
        (mode: Mode) => {
          const config = getModeConfig(mode);

          // Verify config structure
          expect(config.mode).toBe(mode);
          expect(config.agentPriorities).toBeDefined();
          expect(config.llmPromptModifiers).toBeDefined();

          // Verify all agents have priorities
          expect(config.agentPriorities.analyze).toBeGreaterThanOrEqual(1);
          expect(config.agentPriorities.docs).toBeGreaterThanOrEqual(1);
          expect(config.agentPriorities.demo).toBeGreaterThanOrEqual(1);
          expect(config.agentPriorities.pitch).toBeGreaterThanOrEqual(1);

          // Verify LLM prompt modifiers exist
          expect(config.llmPromptModifiers.emphasis).toBeTruthy();
          expect(config.llmPromptModifiers.tone).toBeTruthy();
          expect(config.llmPromptModifiers.focus).toBeInstanceOf(Array);
          expect(config.llmPromptModifiers.focus.length).toBeGreaterThan(0);

          // Mode-specific validations
          if (mode === 'hackathon') {
            // Hackathon should prioritize demo and pitch
            expect(config.agentPriorities.demo).toBeGreaterThanOrEqual(3);
            expect(config.agentPriorities.pitch).toBeGreaterThanOrEqual(3);
            expect(config.llmPromptModifiers.emphasis).toContain('demo');
          } else if (mode === 'placement') {
            // Placement should prioritize docs
            expect(config.agentPriorities.docs).toBeGreaterThanOrEqual(3);
            expect(config.llmPromptModifiers.emphasis).toContain('technical');
          } else if (mode === 'refactor') {
            // Refactor should prioritize analyze
            expect(config.agentPriorities.analyze).toBeGreaterThanOrEqual(3);
            expect(config.llmPromptModifiers.emphasis).toContain('improvements');
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('agent priorities are consistent across all modes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Mode>('hackathon', 'placement', 'refactor'),
        fc.constantFrom('analyze', 'docs', 'demo', 'pitch'),
        (mode: Mode, agent: 'analyze' | 'docs' | 'demo' | 'pitch') => {
          const priority = getAgentPriority(mode, agent);
          
          // Priority should be between 1 and 4
          expect(priority).toBeGreaterThanOrEqual(1);
          expect(priority).toBeLessThanOrEqual(4);

          // Critical agents should have priority >= 3
          const isCritical = isAgentCritical(mode, agent);
          expect(isCritical).toBe(priority >= 3);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('LLM prompt modifiers are properly formatted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Mode>('hackathon', 'placement', 'refactor'),
        (mode: Mode) => {
          const modifier = getLLMPromptModifier(mode);
          const config = getModeConfig(mode);

          // Verify modifier contains mode information
          expect(modifier).toContain(mode.toUpperCase());
          expect(modifier).toContain(config.llmPromptModifiers.emphasis);
          expect(modifier).toContain(config.llmPromptModifiers.tone);

          // Verify all focus points are included
          config.llmPromptModifiers.focus.forEach((point) => {
            expect(modifier).toContain(point);
          });

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('mode descriptions and display names exist for all modes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Mode>('hackathon', 'placement', 'refactor'),
        (mode: Mode) => {
          const description = getModeDescription(mode);
          const displayName = getModeDisplayName(mode);

          // Verify description and display name are non-empty
          expect(description).toBeTruthy();
          expect(description.length).toBeGreaterThan(0);
          expect(displayName).toBeTruthy();
          expect(displayName.length).toBeGreaterThan(0);

          // Display name should be capitalized
          expect(displayName[0]).toBe(displayName[0].toUpperCase());

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('mode validation correctly identifies valid and invalid modes', () => {
    fc.assert(
      fc.property(fc.string(), (input: string) => {
        const isValid = isValidMode(input);
        const validModes = ['hackathon', 'placement', 'refactor'];

        // Should return true only for valid modes
        expect(isValid).toBe(validModes.includes(input));

        return true;
      }),
      { numRuns: 100 }
    );
  });

  test('all modes have complete configuration', () => {
    const modes: Mode[] = ['hackathon', 'placement', 'refactor'];

    modes.forEach((mode) => {
      const config = MODE_CONFIGS[mode];

      // Verify all required fields exist
      expect(config.mode).toBe(mode);
      expect(config.agentPriorities).toBeDefined();
      expect(config.agentPriorities.analyze).toBeDefined();
      expect(config.agentPriorities.docs).toBeDefined();
      expect(config.agentPriorities.demo).toBeDefined();
      expect(config.agentPriorities.pitch).toBeDefined();

      expect(config.llmPromptModifiers).toBeDefined();
      expect(config.llmPromptModifiers.emphasis).toBeDefined();
      expect(config.llmPromptModifiers.tone).toBeDefined();
      expect(config.llmPromptModifiers.focus).toBeDefined();
      expect(config.llmPromptModifiers.focus.length).toBeGreaterThan(0);
    });
  });

  test('hackathon mode prioritizes demo and pitch', () => {
    const config = getModeConfig('hackathon');

    expect(config.agentPriorities.demo).toBeGreaterThanOrEqual(3);
    expect(config.agentPriorities.pitch).toBeGreaterThanOrEqual(3);
    expect(isAgentCritical('hackathon', 'demo')).toBe(true);
    expect(isAgentCritical('hackathon', 'pitch')).toBe(true);
  });

  test('placement mode prioritizes docs', () => {
    const config = getModeConfig('placement');

    expect(config.agentPriorities.docs).toBeGreaterThanOrEqual(3);
    expect(isAgentCritical('placement', 'docs')).toBe(true);
  });

  test('refactor mode prioritizes analyze', () => {
    const config = getModeConfig('refactor');

    expect(config.agentPriorities.analyze).toBeGreaterThanOrEqual(3);
    expect(isAgentCritical('refactor', 'analyze')).toBe(true);
  });
});
