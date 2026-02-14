/**
 * DocsAgent
 * Generates and improves documentation (README, API docs)
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
