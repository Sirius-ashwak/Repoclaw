/**
 * SupervisorAgent
 * Orchestrates all agents and manages the pipeline workflow
 */

import { Agent } from './base';
import { AnalyzeAgent } from './analyze';
import { DocsAgent } from './docs';
import { DemoAgent } from './demo';
import { PitchAgent } from './pitch';
import { Octokit } from '@octokit/rest';
import type {
  AgentType,
  AgentContext,
  AgentResult,
  PullRequestArtifact,
  Artifact,
} from '@/types';

export class SupervisorAgent extends Agent {
  type: AgentType = 'supervisor';

  private agents: {
    analyze: AnalyzeAgent;
    docs: DocsAgent;
    demo: DemoAgent;
    pitch: PitchAgent;
  };

  constructor() {
    super();
    this.agents = {
      analyze: new AnalyzeAgent(),
      docs: new DocsAgent(),
      demo: new DemoAgent(),
      pitch: new PitchAgent(),
    };
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      this.log('Starting supervised pipeline execution');

      const agentResults: Record<AgentType, AgentResult | null> = {
        analyze: null,
        docs: null,
        demo: null,
        pitch: null,
        supervisor: null,
      };

      // Execute agents in sequence: Analyze → Docs → Demo → Pitch
      const sequence: Array<keyof typeof this.agents> = ['analyze', 'docs', 'demo', 'pitch'];

      for (const agentType of sequence) {
        this.log(`Executing ${agentType} agent`);

        try {
          // Update context with previous results
          const agentContext: AgentContext = {
            ...context,
            previousResults: agentResults,
          };

          // Execute agent with timeout
          const result = await this.agents[agentType].executeWithTimeout(agentContext);

          // Validate output
          if (!this.validateAgentOutput(result)) {
            this.logError(`${agentType} agent produced invalid output`);
            
            // Try regeneration once
            this.log(`Attempting to regenerate ${agentType} output`);
            const retryResult = await this.agents[agentType].executeWithTimeout(agentContext);
            
            if (!this.validateAgentOutput(retryResult)) {
              throw new Error(`${agentType} agent failed validation after retry`);
            }
            
            agentResults[agentType] = retryResult;
          } else {
            agentResults[agentType] = result;
          }

          this.log(`${agentType} agent completed successfully`);
        } catch (error) {
          this.logError(`${agentType} agent failed`, error);

          // Handle failure based on agent criticality
          if (agentType === 'analyze' || agentType === 'docs') {
            // Critical agents - fail the pipeline
            throw new Error(`Critical agent ${agentType} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          } else {
            // Optional agents - mark as skipped and continue
            this.log(`Skipping optional agent ${agentType} due to failure`);
            agentResults[agentType] = {
              agent: agentType,
              status: 'skipped',
              artifacts: [],
              error: error instanceof Error ? error.message : 'Unknown error',
              executionTime: 0,
              metadata: { skipped: true },
            };
          }
        }
      }

      // Compile final deliverables
      const allArtifacts = this.compileFinalDeliverables(agentResults);

      // Create PR artifact
      const prArtifact = await this.createPullRequest(context, agentResults);
      allArtifacts.push(prArtifact);

      this.log('Pipeline execution complete', { 
        totalArtifacts: allArtifacts.length,
        executionTime: Date.now() - startTime,
      });

      return this.createSuccessResult(allArtifacts, { agentResults }, Date.now() - startTime);
    } catch (error) {
      this.logError('Pipeline execution failed', error);
      return this.createErrorResult(error, Date.now() - startTime);
    }
  }

  /**
   * Validate agent output
   */
  private validateAgentOutput(result: AgentResult): boolean {
    if (!result) {
      return false;
    }

    // Check required fields
    if (!result.agent || !result.status) {
      return false;
    }

    // Check status is valid
    if (!['completed', 'failed', 'skipped'].includes(result.status)) {
      return false;
    }

    // If completed, should have artifacts (except for failures)
    if (result.status === 'completed' && !result.artifacts) {
      return false;
    }

    return true;
  }

  /**
   * Compile final deliverables from all agents
   */
  private compileFinalDeliverables(
    agentResults: Record<AgentType, AgentResult | null>
  ): Artifact[] {
    const artifacts: Artifact[] = [];

    // Collect artifacts from all agents
    for (const agentType of Object.keys(agentResults) as AgentType[]) {
      const result = agentResults[agentType];
      if (result && result.artifacts) {
        artifacts.push(...result.artifacts);
      }
    }

    return artifacts;
  }

  /**
   * Create pull request with all changes
   */
  private async createPullRequest(
    context: AgentContext,
    agentResults: Record<AgentType, AgentResult | null>
  ): Promise<PullRequestArtifact> {
    const octokit = new Octokit({ auth: context.githubToken });
    const { owner, name, defaultBranch } = context.repoMetadata;

    try {
      // Create branch
      const branchName = `repoclaw-improvements-${Date.now()}`;
      await this.createBranch(octokit, owner, name, defaultBranch, branchName);

      // Apply changes to branch
      await this.applyChangesToBranch(octokit, owner, name, branchName, agentResults);

      // Generate PR content
      const prTitle = this.generatePRTitle(context.mode);
      const prBody = this.generatePRBody(agentResults, context);
      const checklist = this.generatePRChecklist(agentResults);

      // Create PR
      const { data: pr } = await octokit.pulls.create({
        owner,
        repo: name,
        title: prTitle,
        body: prBody + '\n\n' + checklist,
        head: branchName,
        base: defaultBranch,
      });

      // Wait for checks (simplified - in production would poll)
      const checksStatus = await this.validatePRChecks(octokit, owner, name, pr.number);

      const artifact: PullRequestArtifact = {
        id: `pr_${Date.now()}`,
        type: 'pull-request',
        title: 'Pull Request',
        content: `Pull request created: ${pr.html_url}`,
        metadata: {
          prNumber: pr.number,
          prUrl: pr.html_url,
          branch: branchName,
          title: prTitle,
          body: prBody,
          checklist: checklist.split('\n').filter(l => l.trim().startsWith('- [')),
          checksStatus,
        },
        createdAt: Date.now(),
      };

      return artifact;
    } catch (error) {
      this.logError('Failed to create pull request', error);
      
      // Return error artifact
      const artifact: PullRequestArtifact = {
        id: `pr_${Date.now()}`,
        type: 'pull-request',
        title: 'Pull Request (Failed)',
        content: `Failed to create pull request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {
          prNumber: 0,
          prUrl: '',
          branch: '',
          title: '',
          body: '',
          checklist: [],
          checksStatus: 'failing',
        },
        createdAt: Date.now(),
      };

      return artifact;
    }
  }

  /**
   * Create a new branch
   */
  private async createBranch(
    octokit: Octokit,
    owner: string,
    repo: string,
    baseBranch: string,
    newBranch: string
  ): Promise<void> {
    // Get base branch SHA
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });

    // Create new branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: ref.object.sha,
    });
  }

  /**
   * Apply changes to branch
   */
  private async applyChangesToBranch(
    octokit: Octokit,
    owner: string,
    repo: string,
    branch: string,
    agentResults: Record<AgentType, AgentResult | null>
  ): Promise<void> {
    // Collect file changes from docs agent
    const docsResult = agentResults.docs;
    if (docsResult && docsResult.artifacts) {
      for (const artifact of docsResult.artifacts) {
        if (artifact.type === 'readme') {
          // Update README.md
          await this.updateFile(
            octokit,
            owner,
            repo,
            branch,
            'README.md',
            artifact.content,
            'Update README.md with improved documentation'
          );
        } else if (artifact.type === 'api-docs') {
          // Create API_DOCS.md
          await this.updateFile(
            octokit,
            owner,
            repo,
            branch,
            'API_DOCS.md',
            artifact.content,
            'Add API documentation'
          );
        }
      }
    }
  }

  /**
   * Update a file in the repository
   */
  private async updateFile(
    octokit: Octokit,
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string
  ): Promise<void> {
    try {
      // Try to get existing file
      const { data: existingFile } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      // Update existing file
      if ('sha' in existingFile) {
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message,
          content: Buffer.from(content).toString('base64'),
          branch,
          sha: existingFile.sha,
        });
      }
    } catch (error) {
      // File doesn't exist, create it
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
      });
    }
  }

  /**
   * Generate PR title
   */
  private generatePRTitle(mode: string): string {
    const titles = {
      hackathon: '🚀 RepoClaw: Hackathon-Ready Improvements',
      placement: '📚 RepoClaw: Professional Documentation & Enhancements',
      refactor: '♻️ RepoClaw: Code Quality Improvements',
    };

    return titles[mode as keyof typeof titles] || 'RepoClaw: Repository Improvements';
  }

  /**
   * Generate PR body
   */
  private generatePRBody(
    agentResults: Record<AgentType, AgentResult | null>,
    context: AgentContext
  ): string {
    let body = '## RepoClaw Automated Improvements\n\n';
    body += `This PR contains automated improvements generated by RepoClaw in **${context.mode}** mode.\n\n`;

    body += '### Changes Included\n\n';

    // Documentation changes
    const docsResult = agentResults.docs;
    if (docsResult && docsResult.status === 'completed') {
      body += '#### 📚 Documentation\n';
      body += '- ✅ Improved README.md with comprehensive project information\n';
      body += '- ✅ Added installation and usage instructions\n';
      if (docsResult.artifacts.some(a => a.type === 'api-docs')) {
        body += '- ✅ Generated API documentation\n';
      }
      body += '\n';
    }

    // Demo deployment
    const demoResult = agentResults.demo;
    if (demoResult && demoResult.status === 'completed') {
      const demoUrl = demoResult.artifacts[0]?.metadata?.url;
      if (demoUrl) {
        body += '#### 🚀 Live Demo\n';
        body += `- ✅ Deployed to Vercel: [${demoUrl}](${demoUrl})\n`;
        body += '- ✅ QR code generated for mobile access\n\n';
      }
    }

    // Pitch materials
    const pitchResult = agentResults.pitch;
    if (pitchResult && pitchResult.status === 'completed') {
      body += '#### 🎯 Pitch Materials\n';
      body += '- ✅ Architecture diagram generated\n';
      body += '- ✅ Presentation slide deck created\n';
      body += '- ✅ Pitch script with talking points\n\n';
    }

    body += '### Review Notes\n\n';
    body += 'Please review the changes and approve if they meet your requirements. ';
    body += 'You can request modifications or merge as-is.\n\n';

    body += '---\n';
    body += '*Generated by [RepoClaw](https://github.com/Sirius-ashwak/Repoclaw)*';

    return body;
  }

  /**
   * Generate PR checklist
   */
  private generatePRChecklist(
    agentResults: Record<AgentType, AgentResult | null>
  ): string {
    let checklist = '### Checklist\n\n';

    checklist += '- [x] Documentation updated\n';
    checklist += '- [x] Changes reviewed by RepoClaw agents\n';
    
    const demoResult = agentResults.demo;
    if (demoResult && demoResult.status === 'completed') {
      checklist += '- [x] Live demo deployed and accessible\n';
    }

    checklist += '- [ ] Manual review completed\n';
    checklist += '- [ ] Ready to merge\n';

    return checklist;
  }

  /**
   * Validate PR checks
   */
  private async validatePRChecks(
    octokit: Octokit,
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<'pending' | 'passing' | 'failing'> {
    try {
      // Get PR details
      const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      // Check if mergeable
      if (pr.mergeable === false) {
        return 'failing';
      }

      // In a real implementation, would check actual CI/CD status
      // For now, return pending
      return 'pending';
    } catch (error) {
      this.logError('Error validating PR checks', error);
      return 'failing';
    }
  }
}
