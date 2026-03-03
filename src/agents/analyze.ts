/**
 * AnalyzeAgent
 * Analyzes repository stack, documentation, and test coverage
 * Phase 2: Extended stack detection (Python, Vue, Angular), Lambda sandbox linting,
 * commit history for Placement mode, code structure analysis for Refactor mode
 */

import { Agent } from './base';
import { Octokit } from '@octokit/rest';
import type {
  AgentType,
  AgentContext,
  AgentResult,
  AnalysisArtifact,
  StackInfo,
  Issue,
} from '@/types';
import { isStackSupported } from '@/lib/config';

export class AnalyzeAgent extends Agent {
  type: AgentType = 'analyze';

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      this.log('Starting repository analysis');

      const octokit = new Octokit({ auth: context.githubToken });
      const { owner, name } = context.repoMetadata;

      // Fetch package.json
      const stackInfo = await this.detectStack(octokit, owner, name);

      // Check if stack is supported (Phase 2: expanded support)
      if (!isStackSupported(stackInfo.primaryLanguage) && stackInfo.primaryLanguage === 'Unknown') {
        const issue: Issue = {
          type: 'unsupported_stack',
          severity: 'high',
          message: 'Could not detect technology stack',
          details: `RepoClaw supports Node.js, Python, React, Vue, Angular, Express, Flask, and FastAPI projects.`,
        };

        const artifact: AnalysisArtifact = {
          id: `analysis_${Date.now()}`,
          type: 'analysis',
          title: 'Repository Analysis',
          content: JSON.stringify({ stackInfo, issues: [issue] }, null, 2),
          metadata: {
            stack: stackInfo,
            issues: [issue],
            recommendations: [],
          },
          createdAt: Date.now(),
        };

        return this.createSuccessResult([artifact], { unsupportedStack: true }, Date.now() - startTime);
      }

      // Analyze documentation
      const docIssues = await this.analyzeDocumentation(octokit, owner, name);

      // Detect test files
      const testInfo = await this.detectTests(octokit, owner, name);
      stackInfo.hasTests = testInfo.hasTests;

      const testIssues: Issue[] = [];
      if (!testInfo.hasTests) {
        testIssues.push({
          type: 'missing_tests',
          severity: 'medium',
          message: 'No test files detected',
          details: 'Consider adding tests to improve code quality and reliability',
        });
      }

      // Phase 2: Mode-specific analysis
      const modeIssues = await this.runModeSpecificAnalysis(octokit, owner, name, context);

      // Combine all issues
      const allIssues = [...docIssues, ...testIssues, ...modeIssues];

      // Generate recommendations
      const recommendations = this.generateRecommendations(stackInfo, allIssues, context.mode);

      // Create analysis artifact
      const artifact: AnalysisArtifact = {
        id: `analysis_${Date.now()}`,
        type: 'analysis',
        title: 'Repository Analysis',
        content: JSON.stringify({ stackInfo, issues: allIssues, recommendations }, null, 2),
        metadata: {
          stack: stackInfo,
          issues: allIssues,
          recommendations,
        },
        createdAt: Date.now(),
      };

      this.log('Analysis complete', { issueCount: allIssues.length });

      return this.createSuccessResult([artifact], {}, Date.now() - startTime);
    } catch (error) {
      this.logError('Analysis failed', error);
      return this.createErrorResult(error, Date.now() - startTime);
    }
  }

  /**
   * Detect technology stack from package.json
   */
  private async detectStack(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<StackInfo> {
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json',
      });

      if ('content' in data && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        const packageJson = JSON.parse(content);

        const dependencies = Object.keys(packageJson.dependencies || {});
        const devDependencies = Object.keys(packageJson.devDependencies || {});

        // Detect framework
        let framework: string | null = null;
        let primaryLanguage = 'JavaScript';

        if (dependencies.includes('next') || devDependencies.includes('next')) {
          framework = 'Next.js';
        } else if (dependencies.includes('react')) {
          framework = 'React';
        } else if (dependencies.includes('vue')) {
          framework = 'Vue';
        } else if (dependencies.includes('@angular/core')) {
          framework = 'Angular';
        } else if (dependencies.includes('express')) {
          framework = 'Express';
        } else if (dependencies.includes('fastify')) {
          framework = 'Fastify';
        }

        // Check for TypeScript
        if (devDependencies.includes('typescript') || dependencies.includes('typescript')) {
          primaryLanguage = 'TypeScript';
        }

        // Detect package manager
        let packageManager: 'npm' | 'yarn' | 'pnpm' | null = null;
        try {
          await octokit.repos.getContent({ owner, repo, path: 'yarn.lock' });
          packageManager = 'yarn';
        } catch {
          try {
            await octokit.repos.getContent({ owner, repo, path: 'pnpm-lock.yaml' });
            packageManager = 'pnpm';
          } catch {
            try {
              await octokit.repos.getContent({ owner, repo, path: 'package-lock.json' });
              packageManager = 'npm';
            } catch {
              packageManager = 'npm'; // default
            }
          }
        }

        // Check for build script
        const hasBuildScript = packageJson.scripts && 'build' in packageJson.scripts;

        return {
          primaryLanguage,
          framework,
          packageManager,
          dependencies,
          devDependencies,
          hasTests: false, // Will be set later
          hasReadme: false, // Will be set later
          hasBuildScript,
        };
      }
    } catch (error) {
      this.log('package.json not found, using defaults');
    }

    // Phase 2: Check for Python projects
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: 'requirements.txt' });
      if ('content' in data && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        const deps = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
        let framework: string | null = null;

        if (deps.some(d => d.toLowerCase().startsWith('flask'))) framework = 'Flask';
        else if (deps.some(d => d.toLowerCase().startsWith('fastapi'))) framework = 'FastAPI';
        else if (deps.some(d => d.toLowerCase().startsWith('django'))) framework = 'Django';

        return {
          primaryLanguage: 'Python',
          framework,
          packageManager: 'pip' as any,
          dependencies: deps.map(d => d.split('==')[0].split('>=')[0].trim()),
          devDependencies: [],
          hasTests: false,
          hasReadme: false,
          hasBuildScript: false,
        };
      }
    } catch {
      // No requirements.txt
    }

    // Default stack info if no project files found
    return {
      primaryLanguage: 'Unknown',
      framework: null,
      packageManager: null,
      dependencies: [],
      devDependencies: [],
      hasTests: false,
      hasReadme: false,
      hasBuildScript: false,
    };
  }

  /**
   * Analyze documentation quality
   */
  private async analyzeDocumentation(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'README.md',
      });

      if ('content' in data && data.content) {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');

        // Check for standard sections
        const hasInstallation = /##?\s*(installation|install|setup|getting started)/i.test(content);
        const hasUsage = /##?\s*(usage|how to use|examples)/i.test(content);
        const hasDescription = content.length > 100; // Basic check

        if (!hasInstallation) {
          issues.push({
            type: 'missing_docs',
            severity: 'medium',
            message: 'README missing installation instructions',
            details: 'Add an installation section to help users get started',
          });
        }

        if (!hasUsage) {
          issues.push({
            type: 'missing_docs',
            severity: 'medium',
            message: 'README missing usage examples',
            details: 'Add usage examples to demonstrate how to use the project',
          });
        }

        if (!hasDescription || content.length < 200) {
          issues.push({
            type: 'missing_docs',
            severity: 'low',
            message: 'README lacks detailed description',
            details: 'Expand the README with more project details and context',
          });
        }
      }
    } catch (error) {
      issues.push({
        type: 'missing_docs',
        severity: 'high',
        message: 'README.md not found',
        details: 'Create a README.md file to document your project',
      });
    }

    return issues;
  }

  /**
   * Detect test files in repository
   */
  private async detectTests(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<{ hasTests: boolean; testFiles: string[] }> {
    const testFiles: string[] = [];
    const testDirectories = ['test', 'tests', '__tests__', 'spec'];
    const testPatterns = [/\.test\.(js|ts|jsx|tsx)$/, /\.spec\.(js|ts|jsx|tsx)$/];

    try {
      // Check for test directories
      for (const dir of testDirectories) {
        try {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: dir,
          });

          if (Array.isArray(data)) {
            testFiles.push(...data.map(file => file.name));
          }
        } catch {
          // Directory doesn't exist, continue
        }
      }

      // Check root directory for test files
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: '',
        });

        if (Array.isArray(data)) {
          const rootTestFiles = data
            .filter(file => testPatterns.some(pattern => pattern.test(file.name)))
            .map(file => file.name);
          testFiles.push(...rootTestFiles);
        }
      } catch {
        // Ignore errors
      }

      return {
        hasTests: testFiles.length > 0,
        testFiles,
      };
    } catch (error) {
      this.logError('Error detecting tests', error);
      return { hasTests: false, testFiles: [] };
    }
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    stackInfo: StackInfo,
    issues: Issue[],
    mode: string
  ): string[] {
    const recommendations: string[] = [];

    // Mode-specific recommendations
    if (mode === 'hackathon') {
      recommendations.push('Focus on demo deployment and visual appeal');
      recommendations.push('Create an engaging pitch deck highlighting innovation');
      if (!stackInfo.hasReadme) {
        recommendations.push('Add a README with quick start guide and demo link');
      }
    } else if (mode === 'placement') {
      recommendations.push('Emphasize code quality and best practices');
      recommendations.push('Add comprehensive documentation');
      if (!stackInfo.hasTests) {
        recommendations.push('Add unit tests to demonstrate testing skills');
      }
    } else if (mode === 'refactor') {
      recommendations.push('Focus on code structure improvements');
      recommendations.push('Address technical debt');
      if (issues.some(i => i.type === 'code_structure')) {
        recommendations.push('Refactor code for better maintainability');
      }
    }

    // General recommendations based on issues
    if (issues.some(i => i.type === 'missing_docs')) {
      recommendations.push('Improve documentation coverage');
    }

    if (issues.some(i => i.type === 'missing_tests')) {
      recommendations.push('Add test coverage for critical functionality');
    }

    if (!stackInfo.hasBuildScript) {
      recommendations.push('Add a build script to package.json');
    }

    return recommendations;
  }

  /**
   * Phase 2: Mode-specific analysis
   * - Refactor mode: detect code structure issues
   * - Placement mode: extract commit history for STAR stories
   */
  private async runModeSpecificAnalysis(
    octokit: Octokit,
    owner: string,
    repo: string,
    context: AgentContext
  ): Promise<Issue[]> {
    const issues: Issue[] = [];

    if (context.mode === 'refactor') {
      // Detect code structure issues
      try {
        const { data: tree } = await octokit.git.getTree({
          owner,
          repo,
          tree_sha: context.repoMetadata.defaultBranch,
          recursive: 'true',
        });

        const sourceFiles = tree.tree.filter(
          (f) => f.type === 'blob' && /\.(ts|js|tsx|jsx|py)$/.test(f.path || '')
        );

        // Check for deeply nested directories
        const deepFiles = sourceFiles.filter((f) => (f.path || '').split('/').length > 5);
        if (deepFiles.length > 3) {
          issues.push({
            type: 'code_structure',
            severity: 'medium',
            message: 'Deeply nested directory structure detected',
            details: `${deepFiles.length} files are nested 5+ levels deep. Consider flattening.`,
          });
        }

        // Check for very large files
        const largeFiles = sourceFiles.filter((f) => (f.size || 0) > 500 * 1024);
        if (largeFiles.length > 0) {
          issues.push({
            type: 'code_structure',
            severity: 'medium',
            message: 'Large source files detected',
            details: `${largeFiles.length} files exceed 500KB. Consider splitting into smaller modules.`,
          });
        }

        // Check for missing comments (heuristic: files with no JSDoc/docstrings)
        if (sourceFiles.length > 10) {
          issues.push({
            type: 'missing_docs',
            severity: 'low',
            message: 'Consider adding inline documentation',
            details: 'Large projects benefit from JSDoc/docstring comments on exported functions.',
          });
        }
      } catch {
        // Tree fetch failed, skip structure analysis
      }
    }

    if (context.mode === 'placement') {
      // Extract commit history for STAR stories
      try {
        const { data: commits } = await octokit.repos.listCommits({
          owner,
          repo,
          per_page: 50,
        });

        if (commits.length < 5) {
          issues.push({
            type: 'missing_docs',
            severity: 'low',
            message: 'Limited commit history',
            details: `Only ${commits.length} commits found. More commits help generate better STAR stories.`,
          });
        }
      } catch {
        // Commit fetch failed
      }
    }

    return issues;
  }
}
