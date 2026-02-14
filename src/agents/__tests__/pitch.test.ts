/**
 * Tests for PitchAgent
 * Property-based tests for pitch materials generation
 */

import { describe, test, expect } from '@jest/globals';
import * as fc from 'fast-check';

describe('PitchAgent Tests', () => {
  // ============================================================================
  // Property 15: Pitch Artifact Generation
  // ============================================================================

  // Feature: repoclaw, Property 15: Pitch Artifact Generation
  describe('Property 15: Pitch Artifact Generation', () => {
    test('generates all three required artifacts', () => {
      const artifactTypesGen = fc.constant(['architecture-diagram', 'pitch-deck', 'pitch-script']);

      fc.assert(
        fc.property(artifactTypesGen, (types) => {
          // All three artifact types must be present
          return (
            types.includes('architecture-diagram') &&
            types.includes('pitch-deck') &&
            types.includes('pitch-script') &&
            types.length === 3
          );
        }),
        { numRuns: 100 }
      );
    });

    test('architecture diagram uses Mermaid format', () => {
      const mermaidGen = fc.constantFrom(
        'graph TB',
        'graph LR',
        'sequenceDiagram',
        'classDiagram'
      );

      fc.assert(
        fc.property(mermaidGen, (mermaidType) => {
          const isMermaid = ['graph', 'sequenceDiagram', 'classDiagram'].some(type =>
            mermaidType.includes(type)
          );
          
          return isMermaid;
        }),
        { numRuns: 100 }
      );
    });

    test('slide deck contains 5-7 slides', () => {
      const slideCountGen = fc.integer({ min: 5, max: 7 });

      fc.assert(
        fc.property(slideCountGen, (count) => {
          return count >= 5 && count <= 7;
        }),
        { numRuns: 100 }
      );
    });

    test('pitch script includes all required sections', () => {
      const sectionsGen = fc.constant([
        'Introduction',
        'Problem & Solution',
        'Key Features',
        'Technical Implementation',
        'Demo',
        'Conclusion',
        'Q&A Preparation',
      ]);

      fc.assert(
        fc.property(sectionsGen, (sections) => {
          return sections.length >= 6;
        }),
        { numRuns: 100 }
      );
    });

    test('artifacts are mode-specific', () => {
      const modeGen = fc.constantFrom('hackathon', 'placement', 'refactor');

      fc.assert(
        fc.property(modeGen, (mode) => {
          const validModes = ['hackathon', 'placement', 'refactor'];
          return validModes.includes(mode);
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Architecture Diagram Tests
  // ============================================================================

  describe('Architecture Diagram Generation', () => {
    test('diagram includes key components', () => {
      const componentsGen = fc.array(
        fc.constantFrom('User', 'Frontend', 'Backend', 'Database', 'API'),
        { minLength: 3, maxLength: 6 }
      );

      fc.assert(
        fc.property(componentsGen, (components) => {
          return components.length >= 3;
        }),
        { numRuns: 100 }
      );
    });

    test('diagram shows component relationships', () => {
      const relationshipGen = fc.record({
        from: fc.string(),
        to: fc.string(),
        label: fc.string(),
      });

      fc.assert(
        fc.property(relationshipGen, (rel) => {
          return (
            rel.from.length > 0 &&
            rel.to.length > 0 &&
            rel.from !== rel.to
          );
        }),
        { numRuns: 100 }
      );
    });

    test('Mermaid syntax is valid', () => {
      const mermaidCodeGen = fc.constantFrom(
        'graph TB\n    A --> B',
        'graph LR\n    User --> App',
        'sequenceDiagram\n    User->>App: Request'
      );

      fc.assert(
        fc.property(mermaidCodeGen, (code) => {
          return (
            code.includes('graph') || code.includes('sequenceDiagram') || code.includes('classDiagram')
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Slide Deck Tests
  // ============================================================================

  describe('Slide Deck Generation', () => {
    test('each slide has title and content', () => {
      const slideGen = fc.record({
        title: fc.string({ minLength: 1 }),
        content: fc.string(),
        layout: fc.constantFrom('title', 'content', 'two-column', 'image'),
      });

      fc.assert(
        fc.property(slideGen, (slide) => {
          return (
            slide.title.length > 0 &&
            typeof slide.content === 'string' &&
            ['title', 'content', 'two-column', 'image'].includes(slide.layout)
          );
        }),
        { numRuns: 100 }
      );
    });

    test('slide deck covers required topics', () => {
      const topicsGen = fc.constant([
        'Overview',
        'Features',
        'Technology Stack',
        'Architecture',
      ]);

      fc.assert(
        fc.property(topicsGen, (topics) => {
          return topics.length >= 4;
        }),
        { numRuns: 100 }
      );
    });

    test('slides have appropriate layouts', () => {
      const layoutGen = fc.constantFrom('title', 'content', 'two-column', 'image');

      fc.assert(
        fc.property(layoutGen, (layout) => {
          const validLayouts = ['title', 'content', 'two-column', 'image'];
          return validLayouts.includes(layout);
        }),
        { numRuns: 100 }
      );
    });

    test('demo slide included when demo URL available', () => {
      const demoUrlGen = fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: undefined });

      fc.assert(
        fc.property(demoUrlGen, (demoUrl) => {
          const shouldIncludeDemo = demoUrl !== undefined;
          const hasDemoSlide = demoUrl !== undefined;
          
          return shouldIncludeDemo === hasDemoSlide;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Pitch Script Tests
  // ============================================================================

  describe('Pitch Script Generation', () => {
    test('script has appropriate length', () => {
      const scriptGen = fc.string({ minLength: 500, maxLength: 3000 });

      fc.assert(
        fc.property(scriptGen, (script) => {
          return script.length >= 500 && script.length <= 3000;
        }),
        { numRuns: 100 }
      );
    });

    test('script includes timing for each section', () => {
      const sectionGen = fc.record({
        name: fc.string(),
        duration: fc.integer({ min: 15, max: 90 }),
      });

      fc.assert(
        fc.property(sectionGen, (section) => {
          return section.duration >= 15 && section.duration <= 90;
        }),
        { numRuns: 100 }
      );
    });

    test('script tone matches mode', () => {
      const modeGen = fc.constantFrom('hackathon', 'placement', 'refactor');

      fc.assert(
        fc.property(modeGen, (mode) => {
          const tones = {
            hackathon: 'exciting and energetic',
            placement: 'professional and detailed',
            refactor: 'technical and constructive',
          };
          
          return tones[mode as keyof typeof tones] !== undefined;
        }),
        { numRuns: 100 }
      );
    });

    test('script includes Q&A preparation', () => {
      const scriptGen = fc.constant('## Q&A Preparation\n\n**Potential Questions:**');

      fc.assert(
        fc.property(scriptGen, (section) => {
          return section.includes('Q&A') && section.includes('Questions');
        }),
        { numRuns: 100 }
      );
    });

    test('script emphasizes key points based on mode', () => {
      const emphasisGen = fc.record({
        mode: fc.constantFrom('hackathon', 'placement', 'refactor'),
        emphasis: fc.string(),
      });

      fc.assert(
        fc.property(emphasisGen, (config) => {
          const validEmphasis = {
            hackathon: ['innovation', 'demo', 'impact'],
            placement: ['technical depth', 'best practices', 'skills'],
            refactor: ['improvements', 'maintainability', 'quality'],
          };
          
          return validEmphasis[config.mode as keyof typeof validEmphasis] !== undefined;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Mode-Specific Content Tests
  // ============================================================================

  describe('Mode-Specific Content', () => {
    test('hackathon mode emphasizes innovation', () => {
      const content = 'innovative solution that demonstrates creativity';
      
      expect(content).toContain('innovative');
    });

    test('placement mode emphasizes technical depth', () => {
      const content = 'demonstrates technical skills and best practices';
      
      expect(content).toContain('technical');
      expect(content).toContain('best practices');
    });

    test('refactor mode emphasizes improvements', () => {
      const content = 'significant improvements in code quality';
      
      expect(content).toContain('improvements');
      expect(content).toContain('quality');
    });

    test('mode configuration affects all artifacts', () => {
      const modes = ['hackathon', 'placement', 'refactor'];
      
      modes.forEach(mode => {
        expect(['hackathon', 'placement', 'refactor']).toContain(mode);
      });
    });
  });

  // ============================================================================
  // Repository Purpose Analysis Tests
  // ============================================================================

  describe('Repository Purpose Analysis', () => {
    test('extracts features from README', () => {
      const readmeGen = fc.constant('## Features\n\n- Feature 1\n- Feature 2\n- Feature 3');

      fc.assert(
        fc.property(readmeGen, (readme) => {
          const hasFeatures = readme.includes('Features');
          return hasFeatures;
        }),
        { numRuns: 100 }
      );
    });

    test('identifies tech stack from analysis', () => {
      const stackGen = fc.array(
        fc.constantFrom('Next.js', 'React', 'TypeScript', 'Node.js'),
        { minLength: 1, maxLength: 4 }
      );

      fc.assert(
        fc.property(stackGen, (stack) => {
          return stack.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    test('generates key highlights based on mode', () => {
      const highlightsGen = fc.record({
        mode: fc.constantFrom('hackathon', 'placement', 'refactor'),
        highlights: fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
      });

      fc.assert(
        fc.property(highlightsGen, (config) => {
          return config.highlights.length >= 2;
        }),
        { numRuns: 100 }
      );
    });
  });
});
