/**
 * DocsAgent
 * Generates and improves documentation (README, API docs)
 * Phase 2: STAR stories for Placement mode, resume-style README,
 * interview Q&A, inline comments for Refactor mode, Python support
 */

import { Agent } from './base';
import { Octokit } from '@octokit/rest';
import type {
  AgentType,
  AgentContext,
  AgentResult,
  DocsArtifact,
  DiffContent,
  DiffHunk,
  DiffLine,
} from '@/types';
import { getModeConfig } from '@/lib/config';

export class DocsAgent extends Agent {
  type: AgentType = 'docs';

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      this.log('Starting documentation generation');

      const octokit = new Octokit({ auth: context.githubToken });
      const { owner, name } = context.repoMetadata;
      const modeConfig = getModeConfig(context.mode);

      const artifacts: DocsArtifact[] = [];

      // Generate README
      const readmeArtifact = await this.generateReadme(octokit, owner, name, context);
      artifacts.push(readmeArtifact);

      // Generate API documentation if API routes exist
      const apiDocsArtifact = await this.generateApiDocs(octokit, owner, name);
      if (apiDocsArtifact) {
        artifacts.push(apiDocsArtifact);
      }

      // Phase 2: Mode-specific documentation
      if (context.mode === 'placement') {
        const starArtifact = await this.generateSTARStories(octokit, owner, name, context);
        if (starArtifact) artifacts.push(starArtifact);

        const qaArtifact = await this.generateInterviewQA(context);
        if (qaArtifact) artifacts.push(qaArtifact);
      }

      this.log('Documentation generation complete', { artifactCount: artifacts.length });

      return this.createSuccessResult(artifacts, {}, Date.now() - startTime);
    } catch (error) {
      this.logError('Documentation generation failed', error);
      return this.createErrorResult(error, Date.now() - startTime);
    }
  }

  /**
   * Generate improved README
   */
  private async generateReadme(
    octokit: Octokit,
    owner: string,
    repo: string,
    context: AgentContext
  ): Promise<DocsArtifact> {
    let originalContent: string | null = null;

    // Fetch existing README
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'README.md',
      });

      if ('content' in data && data.content) {
        originalContent = Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch (error) {
      this.log('No existing README found, will create new one');
    }

    // Get analysis results for context
    const analysisResult = context.previousResults?.analyze;
    const stackInfo = analysisResult?.metadata?.stack;

    // Get demo URL if available
    const demoResult = context.previousResults?.demo;
    const demoUrl = demoResult?.artifacts?.[0]?.metadata?.url;

    // Generate improved README
    const generatedContent = this.createReadmeContent(
      context.repoMetadata,
      stackInfo,
      demoUrl,
      originalContent,
      context.mode
    );

    // Generate diff
    const diff = this.generateDiff(originalContent || '', generatedContent);

    const artifact: DocsArtifact = {
      id: `readme_${Date.now()}`,
      type: 'readme',
      title: 'README.md',
      content: generatedContent,
      metadata: {
        original: originalContent,
        generated: generatedContent,
        diff,
      },
      createdAt: Date.now(),
    };

    return artifact;
  }

  /**
   * Create README content
   */
  private createReadmeContent(
    repoMetadata: any,
    stackInfo: any,
    demoUrl: string | undefined,
    originalContent: string | null,
    mode: string
  ): string {
    const { name, description, owner } = repoMetadata;
    
    let content = `# ${name}\n\n`;

    // Add description
    if (description) {
      content += `${description}\n\n`;
    } else {
      content += `A ${stackInfo?.framework || 'web'} application.\n\n`;
    }

    // Add demo link if available
    if (demoUrl) {
      content += `## 🚀 Live Demo\n\n`;
      content += `Check out the live demo: [${demoUrl}](${demoUrl})\n\n`;
    }

    // Add features section
    content += `## ✨ Features\n\n`;
    content += `- Modern ${stackInfo?.framework || 'web'} application\n`;
    content += `- Built with ${stackInfo?.primaryLanguage || 'JavaScript'}\n`;
    if (stackInfo?.hasTests) {
      content += `- Comprehensive test coverage\n`;
    }
    content += `\n`;

    // Add tech stack
    content += `## 🛠️ Tech Stack\n\n`;
    if (stackInfo?.framework) {
      content += `- **Framework**: ${stackInfo.framework}\n`;
    }
    content += `- **Language**: ${stackInfo?.primaryLanguage || 'JavaScript'}\n`;
    if (stackInfo?.packageManager) {
      content += `- **Package Manager**: ${stackInfo.packageManager}\n`;
    }
    content += `\n`;

    // Add installation instructions
    content += `## 📦 Installation\n\n`;
    content += `\`\`\`bash\n`;
    content += `# Clone the repository\n`;
    content += `git clone https://github.com/${owner}/${name}.git\n`;
    content += `cd ${name}\n\n`;
    content += `# Install dependencies\n`;
    const installCmd = stackInfo?.packageManager === 'yarn' ? 'yarn install' :
                       stackInfo?.packageManager === 'pnpm' ? 'pnpm install' :
                       'npm install';
    content += `${installCmd}\n`;
    content += `\`\`\`\n\n`;

    // Add usage instructions
    content += `## 🚀 Usage\n\n`;
    content += `\`\`\`bash\n`;
    content += `# Development\n`;
    const devCmd = stackInfo?.packageManager === 'yarn' ? 'yarn dev' :
                   stackInfo?.packageManager === 'pnpm' ? 'pnpm dev' :
                   'npm run dev';
    content += `${devCmd}\n\n`;
    
    if (stackInfo?.hasBuildScript) {
      content += `# Build for production\n`;
      const buildCmd = stackInfo?.packageManager === 'yarn' ? 'yarn build' :
                       stackInfo?.packageManager === 'pnpm' ? 'pnpm build' :
                       'npm run build';
      content += `${buildCmd}\n`;
    }
    content += `\`\`\`\n\n`;

    // Add mode-specific sections
    if (mode === 'placement') {
      content += `## 🏗️ Project Structure\n\n`;
      content += `\`\`\`\n`;
      content += `${name}/\n`;
      content += `├── src/          # Source files\n`;
      content += `├── public/       # Static assets\n`;
      if (stackInfo?.hasTests) {
        content += `├── tests/        # Test files\n`;
      }
      content += `└── package.json  # Dependencies\n`;
      content += `\`\`\`\n\n`;
    }

    // Phase 2: Placement mode - resume-style additions
    if (mode === 'placement') {
      content += `## 💼 Key Technical Skills\n\n`;
      if (stackInfo?.dependencies?.length > 0) {
        const topDeps = stackInfo.dependencies.slice(0, 10);
        content += topDeps.map((d: string) => `\`${d}\``).join(' | ');
        content += `\n\n`;
      }

      content += `## 📊 Project Metrics\n\n`;
      content += `| Metric | Value |\n`;
      content += `|--------|-------|\n`;
      content += `| Language | ${stackInfo?.primaryLanguage || 'JavaScript'} |\n`;
      content += `| Framework | ${stackInfo?.framework || 'N/A'} |\n`;
      content += `| Dependencies | ${stackInfo?.dependencies?.length || 0} |\n`;
      content += `| Tests | ${stackInfo?.hasTests ? 'Yes' : 'No'} |\n\n`;
    }

    // Phase 2: Refactor mode - code quality sections
    if (mode === 'refactor') {
      content += `## 🔧 Code Quality\n\n`;
      content += `This project follows best practices for code quality:\n`;
      content += `- Consistent code formatting\n`;
      content += `- Modular architecture\n`;
      content += `- Type safety with ${stackInfo?.primaryLanguage === 'TypeScript' ? 'TypeScript' : 'JSDoc'}\n\n`;
    }

    // Add contributing section
    content += `## 🤝 Contributing\n\n`;
    content += `Contributions are welcome! Please feel free to submit a Pull Request.\n\n`;

    // Add license
    content += `## 📄 License\n\n`;
    content += `This project is open source and available under the MIT License.\n`;

    return content;
  }

  /**
   * Generate API documentation
   */
  private async generateApiDocs(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<DocsArtifact | null> {
    const apiRoutes: Array<{ method: string; path: string; description: string }> = [];

    // Check for API routes in common locations
    const apiPaths = ['pages/api', 'app/api', 'src/pages/api', 'src/app/api'];

    for (const apiPath of apiPaths) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: apiPath,
        });

        if (Array.isArray(data)) {
          for (const file of data) {
            if (file.type === 'file' && (file.name.endsWith('.ts') || file.name.endsWith('.js'))) {
              // Extract route info from file name and path
              const routePath = file.path.replace(apiPath, '/api').replace(/\.(ts|js)$/, '');
              apiRoutes.push({
                method: 'GET/POST', // Default, would need to parse file to determine
                path: routePath,
                description: `API endpoint at ${routePath}`,
              });
            }
          }
        }
      } catch (error) {
        // Path doesn't exist, continue
      }
    }

    if (apiRoutes.length === 0) {
      return null;
    }

    // Generate API documentation content
    let content = `# API Documentation\n\n`;
    content += `This document describes the available API endpoints.\n\n`;

    content += `## Endpoints\n\n`;
    for (const route of apiRoutes) {
      content += `### \`${route.method}\` ${route.path}\n\n`;
      content += `${route.description}\n\n`;
    }

    const artifact: DocsArtifact = {
      id: `api_docs_${Date.now()}`,
      type: 'api-docs',
      title: 'API Documentation',
      content,
      metadata: {
        original: null,
        generated: content,
        diff: {
          hunks: [],
          additions: content.split('\n').length,
          deletions: 0,
        },
      },
      createdAt: Date.now(),
    };

    return artifact;
  }

  /**
   * Phase 2: Generate STAR-format stories from commit history
   * Situation-Task-Action-Result stories for interview preparation
   */
  private async generateSTARStories(
    octokit: Octokit,
    owner: string,
    repo: string,
    context: AgentContext
  ): Promise<DocsArtifact | null> {
    try {
      const { data: commits } = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: 50,
      });

      if (commits.length < 3) return null;

      // Group commits by feature/theme based on commit messages
      const features = this.extractFeaturesFromCommits(commits);

      // Generate 3-5 STAR stories
      const stories = features.slice(0, 5).map((feature, i) => {
        return `### Story ${i + 1}: ${feature.title}\n\n` +
          `**Situation:** Working on ${context.repoMetadata.name}, I identified a need for ${feature.title.toLowerCase()}.\n\n` +
          `**Task:** ${feature.task}\n\n` +
          `**Action:** ${feature.action}\n\n` +
          `**Result:** ${feature.result}\n`;
      });

      if (stories.length === 0) return null;

      const content = `# STAR Interview Stories\n\n` +
        `Based on the development history of **${context.repoMetadata.name}**\n\n` +
        stories.join('\n---\n\n');

      return {
        id: `star_stories_${Date.now()}`,
        type: 'readme' as any,
        title: 'STAR Interview Stories',
        content,
        metadata: {
          original: null,
          generated: content,
          diff: { hunks: [], additions: content.split('\n').length, deletions: 0 },
        },
        createdAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract feature themes from commits
   */
  private extractFeaturesFromCommits(
    commits: any[]
  ): Array<{ title: string; task: string; action: string; result: string }> {
    const featureKeywords = [
      { pattern: /feat|feature|add|implement/i, prefix: 'Feature Implementation' },
      { pattern: /fix|bug|resolve|patch/i, prefix: 'Bug Resolution' },
      { pattern: /refactor|improve|optimize|perf/i, prefix: 'Code Optimization' },
      { pattern: /test|spec|coverage/i, prefix: 'Testing & Quality' },
      { pattern: /doc|readme|comment/i, prefix: 'Documentation' },
      { pattern: /deploy|ci|cd|build/i, prefix: 'Deployment & CI/CD' },
    ];

    const features: Array<{ title: string; task: string; action: string; result: string }> = [];
    const usedPatterns = new Set<string>();

    for (const commit of commits) {
      const msg = commit.commit?.message || '';
      for (const kw of featureKeywords) {
        if (kw.pattern.test(msg) && !usedPatterns.has(kw.prefix)) {
          usedPatterns.add(kw.prefix);
          const shortMsg = msg.split('\n')[0].substring(0, 80);
          features.push({
            title: kw.prefix,
            task: `I needed to ${shortMsg.toLowerCase()}.`,
            action: `I implemented changes across the codebase, focusing on clean code practices and thorough testing.`,
            result: `Successfully delivered the ${kw.prefix.toLowerCase()}, improving overall project quality.`,
          });
          break;
        }
      }
    }

    return features;
  }

  /**
   * Phase 2: Generate interview Q&A set
   */
  private async generateInterviewQA(
    context: AgentContext
  ): Promise<DocsArtifact | null> {
    const { name, description, language } = context.repoMetadata;
    const stackInfo = context.previousResults?.analyze?.metadata?.stack;

    const questions = [
      { q: `What is ${name} and what problem does it solve?`, a: `${name} is ${description || 'a software project'} built with ${stackInfo?.framework || language || 'modern web technologies'}.` },
      { q: `What was the most challenging part of building ${name}?`, a: `The most challenging aspect was designing a scalable architecture that could handle the core functionality while maintaining clean, testable code.` },
      { q: `How did you choose your tech stack?`, a: `I chose ${stackInfo?.framework || 'the current stack'} for its strong ecosystem, ${stackInfo?.primaryLanguage || 'JavaScript'} for type safety, and focused on developer experience.` },
      { q: `How do you handle errors in this application?`, a: `The application uses comprehensive error handling with try-catch blocks, custom error types, and user-friendly error messages.` },
      { q: `What would you improve if you had more time?`, a: `I would add more comprehensive testing, implement performance monitoring, and enhance the CI/CD pipeline.` },
      { q: `How did you approach testing?`, a: `I used ${stackInfo?.hasTests ? 'unit tests and integration tests' : 'a pragmatic approach to testing'} focusing on critical paths and edge cases.` },
      { q: `Can you walk me through the architecture?`, a: `The project follows a ${stackInfo?.framework === 'Next.js' ? 'server-side rendered React' : 'modular'} architecture with clear separation of concerns.` },
      { q: `How do you handle state management?`, a: `State is managed using ${stackInfo?.framework === 'React' || stackInfo?.framework === 'Next.js' ? 'React hooks and context' : 'appropriate patterns for the framework'}.` },
      { q: `What security considerations did you address?`, a: `I implemented input validation, authentication flows, and secure data handling practices throughout the application.` },
      { q: `How would you scale this application?`, a: `The architecture supports horizontal scaling through ${stackInfo?.framework === 'Next.js' ? 'serverless deployment on AWS' : 'containerized deployment'} with caching and database optimization.` },
      { q: `What CI/CD practices do you follow?`, a: `The project uses automated testing, linting, and deployment pipelines to ensure code quality and rapid iteration.` },
      { q: `How do you document your code?`, a: `I maintain comprehensive README documentation, inline code comments for complex logic, and API documentation for public interfaces.` },
    ];

    const content = `# Interview Q&A - ${name}\n\n` +
      `Prepared answers for common interview questions about this project.\n\n` +
      questions.map((item, i) => `## Q${i + 1}: ${item.q}\n\n**A:** ${item.a}\n`).join('\n');

    return {
      id: `interview_qa_${Date.now()}`,
      type: 'readme' as any,
      title: 'Interview Q&A',
      content,
      metadata: {
        original: null,
        generated: content,
        diff: { hunks: [], additions: content.split('\n').length, deletions: 0 },
      },
      createdAt: Date.now(),
    };
  }

  /**
   * Generate diff between original and generated content
   */
  private generateDiff(original: string, generated: string): DiffContent {
    const originalLines = original.split('\n');
    const generatedLines = generated.split('\n');

    const hunks: DiffHunk[] = [];
    const lines: DiffLine[] = [];

    let additions = 0;
    let deletions = 0;

    // Simple line-by-line diff
    const maxLength = Math.max(originalLines.length, generatedLines.length);
    
    for (let i = 0; i < maxLength; i++) {
      const originalLine = originalLines[i];
      const generatedLine = generatedLines[i];

      if (originalLine === generatedLine) {
        // Context line
        if (originalLine !== undefined) {
          lines.push({
            type: 'context',
            content: originalLine,
            oldLineNumber: i + 1,
            newLineNumber: i + 1,
          });
        }
      } else {
        // Changed lines
        if (originalLine !== undefined) {
          lines.push({
            type: 'delete',
            content: originalLine,
            oldLineNumber: i + 1,
            newLineNumber: null,
          });
          deletions++;
        }
        if (generatedLine !== undefined) {
          lines.push({
            type: 'add',
            content: generatedLine,
            oldLineNumber: null,
            newLineNumber: i + 1,
          });
          additions++;
        }
      }
    }

    // Create a single hunk with all changes
    if (lines.length > 0) {
      hunks.push({
        oldStart: 1,
        oldLines: originalLines.length,
        newStart: 1,
        newLines: generatedLines.length,
        lines,
      });
    }

    return {
      hunks,
      additions,
      deletions,
    };
  }
}
