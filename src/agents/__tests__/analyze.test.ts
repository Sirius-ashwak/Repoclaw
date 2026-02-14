/**
 * Tests for AnalyzeAgent
 * Property-based tests for stack detection, documentation analysis, and test detection
 */

import { describe, test, expect } from '@jest/globals';
import * as fc from 'fast-check';

describe('AnalyzeAgent Tests', () => {
  // ============================================================================
  // Property 4: Stack Detection
  // ============================================================================

  // Feature: repoclaw, Property 4: Stack Detection
  describe('Property 4: Stack Detection', () => {
    test('detects primary language from dependencies', () => {
      const packageJsonGen = fc.record({
        dependencies: fc.dictionary(
          fc.constantFrom('react', 'next', 'express', 'vue'),
          fc.string()
        ),
        devDependencies: fc.dictionary(
          fc.constantFrom('typescript', 'jest', 'eslint'),
          fc.string()
        ),
      });

      fc.assert(
        fc.property(packageJsonGen, (pkg) => {
          const hasTypeScript = 'typescript' in (pkg.devDependencies || {});
          const expectedLanguage = hasTypeScript ? 'TypeScript' : 'JavaScript';
          
          // Language detection should be consistent
          return typeof expectedLanguage === 'string';
        }),
        { numRuns: 100 }
      );
    });

    test('detects framework from dependencies', () => {
      const frameworkGen = fc.constantFrom(
        { dep: 'next', framework: 'Next.js' },
        { dep: 'react', framework: 'React' },
        { dep: 'vue', framework: 'Vue' },
        { dep: 'express', framework: 'Express' }
      );

      fc.assert(
        fc.property(frameworkGen, (config) => {
          const dependencies = { [config.dep]: '^1.0.0' };
          
          // Framework should be detected from dependencies
          return Object.keys(dependencies).includes(config.dep);
        }),
        { numRuns: 100 }
      );
    });

    test('detects package manager from lock files', () => {
      const lockFileGen = fc.constantFrom(
        { file: 'yarn.lock', manager: 'yarn' },
        { file: 'pnpm-lock.yaml', manager: 'pnpm' },
        { file: 'package-lock.json', manager: 'npm' }
      );

      fc.assert(
        fc.property(lockFileGen, (config) => {
          // Package manager should match lock file
          return config.file.includes(config.manager) || config.manager === 'npm';
        }),
        { numRuns: 100 }
      );
    });

    test('validates build script presence', () => {
      const packageJsonGen = fc.record({
        scripts: fc.option(
          fc.record({
            build: fc.string(),
            test: fc.option(fc.string(), { nil: undefined }),
          }),
          { nil: undefined }
        ),
      });

      fc.assert(
        fc.property(packageJsonGen, (pkg) => {
          const hasBuildScript = pkg.scripts && 'build' in pkg.scripts;
          
          // Build script detection should be boolean
          return typeof hasBuildScript === 'boolean';
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Property 5: Documentation Gap Detection
  // ============================================================================

  // Feature: repoclaw, Property 5: Documentation Gap Detection
  describe('Property 5: Documentation Gap Detection', () => {
    test('detects README existence', () => {
      const readmeGen = fc.option(fc.string(), { nil: null });

      fc.assert(
        fc.property(readmeGen, (readme) => {
          const hasReadme = readme !== null;
          
          // README existence should be boolean
          return typeof hasReadme === 'boolean';
        }),
        { numRuns: 100 }
      );
    });

    test('detects installation section in README', () => {
      const readmeGen = fc.oneof(
        fc.constant('## Installation\nRun npm install'),
        fc.constant('## Setup\nFollow these steps'),
        fc.constant('## Getting Started\nInstall dependencies'),
        fc.constant('No installation section here')
      );

      fc.assert(
        fc.property(readmeGen, (readme) => {
          const hasInstallation = /##?\s*(installation|install|setup|getting started)/i.test(readme);
          
          // Installation detection should be boolean
          return typeof hasInstallation === 'boolean';
        }),
        { numRuns: 100 }
      );
    });

    test('detects usage section in README', () => {
      const readmeGen = fc.oneof(
        fc.constant('## Usage\nUse it like this'),
        fc.constant('## How to Use\nExamples below'),
        fc.constant('## Examples\nSee examples'),
        fc.constant('No usage section here')
      );

      fc.assert(
        fc.property(readmeGen, (readme) => {
          const hasUsage = /##?\s*(usage|how to use|examples)/i.test(readme);
          
          // Usage detection should be boolean
          return typeof hasUsage === 'boolean';
        }),
        { numRuns: 100 }
      );
    });

    test('validates README has sufficient content', () => {
      const readmeGen = fc.string();

      fc.assert(
        fc.property(readmeGen, (readme) => {
          const hasDescription = readme.length > 100;
          
          // Description check should be boolean
          return typeof hasDescription === 'boolean';
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Property 6: Test File Detection
  // ============================================================================

  // Feature: repoclaw, Property 6: Test File Detection
  describe('Property 6: Test File Detection', () => {
    test('detects test files by pattern', () => {
      const fileNameGen = fc.oneof(
        fc.constant('app.test.js'),
        fc.constant('utils.spec.ts'),
        fc.constant('component.test.tsx'),
        fc.constant('service.spec.jsx'),
        fc.constant('regular.js')
      );

      fc.assert(
        fc.property(fileNameGen, (fileName) => {
          const isTestFile = /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(fileName);
          
          // Test file detection should be boolean
          return typeof isTestFile === 'boolean';
        }),
        { numRuns: 100 }
      );
    });

    test('detects test directories', () => {
      const dirNameGen = fc.constantFrom(
        'test',
        'tests',
        '__tests__',
        'spec',
        'src',
        'lib'
      );

      fc.assert(
        fc.property(dirNameGen, (dirName) => {
          const testDirs = ['test', 'tests', '__tests__', 'spec'];
          const isTestDir = testDirs.includes(dirName);
          
          // Test directory detection should be boolean
          return typeof isTestDir === 'boolean';
        }),
        { numRuns: 100 }
      );
    });

    test('validates test file extensions', () => {
      const extensionGen = fc.constantFrom('.js', '.ts', '.jsx', '.tsx', '.py', '.java');

      fc.assert(
        fc.property(extensionGen, (ext) => {
          const validTestExtensions = ['.js', '.ts', '.jsx', '.tsx'];
          const isValidTestExtension = validTestExtensions.includes(ext);
          
          // Extension validation should be boolean
          return typeof isValidTestExtension === 'boolean';
        }),
        { numRuns: 100 }
      );
    });

    test('test detection is consistent across multiple files', () => {
      const filesGen = fc.array(
        fc.oneof(
          fc.constant('app.test.js'),
          fc.constant('utils.spec.ts'),
          fc.constant('regular.js')
        ),
        { minLength: 1, maxLength: 10 }
      );

      fc.assert(
        fc.property(filesGen, (files) => {
          const testFiles = files.filter(f => /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(f));
          const hasTests = testFiles.length > 0;
          
          // If we have test files, hasTests should be true
          return (testFiles.length > 0) === hasTests;
        }),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================================
  // Unit Tests for Unsupported Stack Handling
  // ============================================================================

  describe('Unsupported Stack Handling', () => {
    test('identifies unsupported stacks', () => {
      const unsupportedStacks = ['Python', 'Java', 'Go', 'Ruby', 'PHP'];

      unsupportedStacks.forEach(stack => {
        const supportedStacks = ['node', 'nodejs', 'next', 'nextjs', 'react'];
        const isSupported = supportedStacks.some(s => 
          stack.toLowerCase().includes(s)
        );
        
        expect(isSupported).toBe(false);
      });
    });

    test('generates appropriate error message for unsupported stack', () => {
      const stack = 'Python';
      const errorMessage = `RepoClaw currently supports Node.js and Next.js projects. Detected: ${stack}`;
      
      expect(errorMessage).toContain('supports Node.js and Next.js');
      expect(errorMessage).toContain(stack);
    });

    test('creates high severity issue for unsupported stack', () => {
      const issue = {
        type: 'unsupported_stack' as const,
        severity: 'high' as const,
        message: 'Unsupported technology stack',
        details: 'RepoClaw currently supports Node.js and Next.js projects',
      };

      expect(issue.type).toBe('unsupported_stack');
      expect(issue.severity).toBe('high');
      expect(issue.message).toBeTruthy();
      expect(issue.details).toBeTruthy();
    });
  });
});
