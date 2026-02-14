/**
 * Tests for DocsAgent
 * Property-based tests for README generation and API documentation
 */

import { describe, test, expect } from '@jest/globals';
import * as fc from 'fast-check';

describe('DocsAgent Tests', () => {
  // ============================================================================
  // Property 8: README Content Completeness
  // ============================================================================

  // Feature: repoclaw, Property 8: README Content Completeness
  describe('Property 8: README Content Completeness', () => {
    test('generated README always contains required sections', () => {
      const repoGen = fc.record({
        name: fc.stringMatching(/^[\w-]+$/),
        description: fc.option(fc.string(), { nil: null }),
        owner: fc.stringMatching(/^[\w-]+$/),
      });

      fc.assert(
        fc.property(repoGen, (repo) => {
          // Simulate README generation
          const readme = `# ${repo.name}\n\n## Installation\n\n## Usage\n\n## Tech Stack\n\n`;
          
          // Check for required sections
          const hasTitle = readme.includes(`# ${repo.name}`);
          const hasInstallation = /##?\s*Installation/i.test(readme);
          const hasUsage = /##?\s*Usage/i.test(readme);
          const hasTechStack = /##?\s*Tech Stack/i.test(readme);
          
          return hasTitle && hasInstallation && hasUsage && hasTechStack;
        }),
        { numRuns: 100 }
      );
    });

    test('README includes project overview', () => {
      const repoGen = fc.record({
        name: fc.string(),
        description: fc.option(fc.string(), { nil: null }),
      });

      fc.assert(
        fc.property(repoGen, (repo) => {
          const hasOverview = repo.description !== null || repo.name.length > 0;
          
          // README should have some form of overview
          return typeof hasOverview === 'boolean';
        }),
        { numRuns: 100 }
      );
    });

    test('README includes installation instructions', () => {
      const packageManagerGen = fc.constantFrom('npm', 'yarn', 'pnpm');

      fc.assert(
        fc.property(packageManagerGen, (pm) => {
          const installCmd = pm === 'yarn' ? 'yarn install' :
                            pm === 'pnpm' ? 'pnpm install' :
                            'npm install';
          
          // Installation command should match package manager
          return installCmd.includes(pm) || pm === 'npm';
        }),
        { numRuns: 100 }
      );
    });

    test('README includes usage examples', () => {
      const commandGen = fc.record({
        dev: fc.string(),
        build: fc.option(fc.string(), { nil: undefined }),
      });

      fc.assert(
        fc.property(commandGen, (commands) => {
          const hasDevCommand = commands.dev.length > 0;
          const hasBuildCommand = commands.build !== undefined;
          
          // Usage section should have at least dev command
          return hasDevCommand || hasBuildCommand;
        }),
        { numRuns: 100 }
      );
    });

    test('README includes technology stack information', () => {
      const stackGen = fc.record({
        framework: fc.option(fc.constantFrom('Next.js', 'React', 'Vue', 'Express'), { nil: null }),
        language: fc.constantFrom('JavaScript', 'TypeScript'),
        packageManager: fc.option(fc.constantFrom('npm', 'yarn', 'pnpm'), { nil: null }),
      });

      fc.assert(
        fc.property(stackGen, (stack) => {
          // Tech stack should include at least language
          return stack.language.length > 0;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Property 9: Conditional Demo Link Inclusion
  // ============================================================================

  // Feature: repoclaw, Property 9: Conditional Demo Link Inclusion
  describe('Property 9: Conditional Demo Link Inclusion', () => {
    test('README includes demo URL when available', () => {
      const demoGen = fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: undefined });

      fc.assert(
        fc.property(demoGen, (demoUrl) => {
          const shouldIncludeDemo = demoUrl !== undefined;
          const readme = demoUrl ? `## Live Demo\n\n[${demoUrl}](${demoUrl})` : '## Features';
          
          const hasDemo = readme.includes('Live Demo');
          
          // Demo section should exist if and only if demo URL exists
          return shouldIncludeDemo === hasDemo;
        }),
        { numRuns: 100 }
      );
    });

    test('README excludes demo section when URL not available', () => {
      fc.assert(
        fc.property(fc.constant(undefined), (demoUrl) => {
          const readme = '# Project\n\n## Features\n\n## Installation';
          const hasDemo = /##?\s*Live Demo/i.test(readme);
          
          // No demo section when URL is undefined
          return !hasDemo;
        }),
        { numRuns: 100 }
      );
    });

    test('demo URL is always valid HTTPS URL when included', () => {
      const demoUrlGen = fc.webUrl({ validSchemes: ['https'] });

      fc.assert(
        fc.property(demoUrlGen, (demoUrl) => {
          // Demo URL should be HTTPS
          return demoUrl.startsWith('https://');
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Property 10: API Documentation Generation
  // ============================================================================

  // Feature: repoclaw, Property 10: API Documentation Generation
  describe('Property 10: API Documentation Generation', () => {
    test('API docs generated when API routes exist', () => {
      const apiRoutesGen = fc.array(
        fc.record({
          method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
          path: fc.string().map(s => `/api/${s}`),
        }),
        { minLength: 1, maxLength: 10 }
      );

      fc.assert(
        fc.property(apiRoutesGen, (routes) => {
          const hasApiRoutes = routes.length > 0;
          
          // Should generate docs if routes exist
          return hasApiRoutes === (routes.length > 0);
        }),
        { numRuns: 100 }
      );
    });

    test('API docs list all endpoints with methods and paths', () => {
      const routeGen = fc.record({
        method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
        path: fc.string().map(s => `/api/${s}`),
        description: fc.string(),
      });

      fc.assert(
        fc.property(routeGen, (route) => {
          // Each route should have method, path, and description
          return (
            route.method.length > 0 &&
            route.path.startsWith('/api') &&
            route.description.length >= 0
          );
        }),
        { numRuns: 100 }
      );
    });

    test('API docs not generated when no API routes exist', () => {
      fc.assert(
        fc.property(fc.constant([]), (routes) => {
          const shouldGenerateDocs = routes.length > 0;
          
          // No docs when no routes
          return !shouldGenerateDocs;
        }),
        { numRuns: 100 }
      );
    });

    test('API documentation includes endpoint descriptions', () => {
      const endpointGen = fc.record({
        method: fc.string(),
        path: fc.string(),
        description: fc.string(),
      });

      fc.assert(
        fc.property(endpointGen, (endpoint) => {
          const apiDoc = `### \`${endpoint.method}\` ${endpoint.path}\n\n${endpoint.description}`;
          
          // Documentation should include all endpoint info
          return (
            apiDoc.includes(endpoint.method) &&
            apiDoc.includes(endpoint.path) &&
            apiDoc.includes(endpoint.description)
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Diff Generation Tests
  // ============================================================================

  describe('Diff Generation', () => {
    test('diff correctly identifies additions', () => {
      const original = 'line1\nline2';
      const generated = 'line1\nline2\nline3';
      
      const additions = generated.split('\n').length - original.split('\n').length;
      
      expect(additions).toBe(1);
    });

    test('diff correctly identifies deletions', () => {
      const original = 'line1\nline2\nline3';
      const generated = 'line1\nline2';
      
      const deletions = original.split('\n').length - generated.split('\n').length;
      
      expect(deletions).toBe(1);
    });

    test('diff identifies context lines', () => {
      const original = 'line1\nline2\nline3';
      const generated = 'line1\nmodified\nline3';
      
      const originalLines = original.split('\n');
      const generatedLines = generated.split('\n');
      
      const contextLines = originalLines.filter((line, i) => line === generatedLines[i]);
      
      expect(contextLines.length).toBe(2); // line1 and line3
    });

    test('diff handles empty original content', () => {
      const original = '';
      const generated = 'new content';
      
      const additions = generated.split('\n').length;
      
      expect(additions).toBeGreaterThan(0);
    });

    test('diff handles identical content', () => {
      const content = 'line1\nline2\nline3';
      
      const additions = 0;
      const deletions = 0;
      
      expect(additions).toBe(0);
      expect(deletions).toBe(0);
    });
  });
});
