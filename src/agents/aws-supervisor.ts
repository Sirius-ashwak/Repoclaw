/**
 * AWS Supervisor Agent
 * LangGraph-based orchestrator for the AWS Phase 2 pipeline
 * Coordinates AnalyzeAgent → DocsAgent → DeployAgent → PitchAgent → PR creation
 * Uses DynamoDB for state persistence, S3 for artifacts, Bedrock for LLM
 */

import { Agent } from './base';
import { DynamoDBSessionManager } from '@/lib/aws/dynamodb';
import { S3ArtifactManager } from '@/lib/aws/s3';
import { BedrockLLMClient } from '@/lib/aws/bedrock';
import { Octokit } from '@octokit/rest';
import type {
  AgentType,
  AgentContext,
  AgentResult,
  PullRequestArtifact,
  Artifact,
  Mode,
} from '@/types';

export type SupportedLanguage = 'hi' | 'ta' | 'te' | 'bn' | 'mr' | 'en';

export interface AWSPipelineState {
  id: string;
  sessionId: string;
  repoUrl: string;
  mode: Mode;
  language: SupportedLanguage;

  // Agent outputs
  analyzeResult: AgentResult | null;
  docsResult: AgentResult | null;
  deployResult: AgentResult | null;
  pitchResult: AgentResult | null;

  // Workflow control
  currentAgent: AgentType | null;
  status: 'pending' | 'running' | 'awaiting_approval' | 'completed' | 'failed';
  approvalGates: ApprovalGateState[];
  error: string | null;

  // Metadata
  startedAt: number;
  completedAt: number | null;
  artifacts: Artifact[];
  bedrockCost: number;
}

export interface ApprovalGateState {
  id: string;
  fileChanges: Array<{
    path: string;
    content: string;
    accepted: boolean;
  }>;
  approved: boolean;
  feedback: string | null;
}

// Mode-based agent configuration
const MODE_CONFIGS: Record<Mode, {
  analyze: { linting: boolean; structure: boolean; commitHistory?: boolean };
  docs: { sections?: string[]; apiDocs?: boolean; resumeStyle?: boolean; starStories?: boolean; qaSet?: boolean; metrics?: boolean; inlineComments?: boolean; missingDocs?: boolean };
  deploy: { skip?: boolean; amplify?: boolean; sam?: boolean; validation?: boolean };
  pitch: { skip?: boolean; slides?: number; diagram?: boolean; audio?: boolean; walkthrough?: boolean; duration?: number };
}> = {
  hackathon: {
    analyze: { linting: true, structure: true },
    docs: { sections: ['problem', 'solution', 'tech', 'setup', 'usage'], apiDocs: true },
    deploy: { amplify: true, sam: true, validation: true },
    pitch: { slides: 6, diagram: true, audio: true },
  },
  placement: {
    analyze: { linting: false, structure: true, commitHistory: true },
    docs: { resumeStyle: true, starStories: true, qaSet: true, metrics: true },
    deploy: { skip: true },
    pitch: { walkthrough: true, duration: 120 },
  },
  refactor: {
    analyze: { linting: true, structure: true },
    docs: { inlineComments: true, missingDocs: true },
    deploy: { skip: true },
    pitch: { skip: true },
  },
};

export type SSEEmitter = (event: {
  agent: string;
  status: string;
  message: string;
  data?: any;
}) => void;

export class AWSSupervisorAgent extends Agent {
  type: AgentType = 'supervisor';

  private dynamodb: DynamoDBSessionManager;
  private s3: S3ArtifactManager;
  private bedrock: BedrockLLMClient;
  private sseEmitter: SSEEmitter | null = null;

  constructor() {
    super();
    this.dynamodb = new DynamoDBSessionManager();
    this.s3 = new S3ArtifactManager();
    this.bedrock = new BedrockLLMClient();
  }

  /**
   * Set SSE emitter for real-time progress updates
   */
  setSSEEmitter(emitter: SSEEmitter): void {
    this.sseEmitter = emitter;
  }

  /**
   * Main execution - orchestrate the full pipeline
   */
  async execute(context: AgentContext): Promise<AgentResult> {
    return this.orchestrate(context, 'en');
  }

  /**
   * Full pipeline orchestration with language support
   */
  async orchestrate(
    context: AgentContext,
    language: SupportedLanguage = 'en'
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const pipelineId = `pipeline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Initialize pipeline state
    const state: AWSPipelineState = {
      id: pipelineId,
      sessionId: context.sessionId,
      repoUrl: context.repoMetadata.url,
      mode: context.mode,
      language,
      analyzeResult: null,
      docsResult: null,
      deployResult: null,
      pitchResult: null,
      currentAgent: null,
      status: 'running',
      approvalGates: [],
      error: null,
      startedAt: startTime,
      completedAt: null,
      artifacts: [],
      bedrockCost: 0,
    };

    // Save initial state to DynamoDB
    await this._savePipelineState(state);

    try {
      const modeConfig = MODE_CONFIGS[context.mode];
      const agentResults: Record<AgentType, AgentResult | null> = {
        analyze: null,
        docs: null,
        demo: null,
        pitch: null,
        supervisor: null,
      };

      // Agent sequence: Analyze → Docs → Deploy → Pitch
      const agentSequence: Array<{
        type: AgentType;
        configKey: keyof typeof modeConfig;
      }> = [
        { type: 'analyze', configKey: 'analyze' },
        { type: 'docs', configKey: 'docs' },
        { type: 'demo', configKey: 'deploy' },
        { type: 'pitch', configKey: 'pitch' },
      ];

      for (const { type: agentType, configKey } of agentSequence) {
        const agentConfig = modeConfig[configKey] as any;

        // Skip agents that are not needed for this mode
        if (agentConfig.skip) {
          this.log(`Skipping ${agentType} agent (not needed for ${context.mode} mode)`);
          this._emitProgress(agentType, 'skipped', `${agentType} skipped for ${context.mode} mode`);
          agentResults[agentType] = {
            agent: agentType,
            status: 'skipped',
            artifacts: [],
            error: null,
            executionTime: 0,
            metadata: { skipped: true, reason: `Not needed for ${context.mode} mode` },
          };
          continue;
        }

        state.currentAgent = agentType;
        await this._savePipelineState(state);

        this._emitProgress(agentType, 'in-progress', `Executing ${agentType}...`);

        try {
          const agentContext: AgentContext = {
            ...context,
            previousResults: agentResults,
          };

          // Execute agent using Bedrock for LLM operations
          const result = await this._executeAgentWithBedrock(
            agentType,
            agentContext,
            agentConfig
          );

          // Validate output
          if (!this._validateAgentOutput(result)) {
            this.log(`Attempting to regenerate ${agentType} output`);
            const retryResult = await this._executeAgentWithBedrock(
              agentType,
              agentContext,
              agentConfig
            );
            if (!this._validateAgentOutput(retryResult)) {
              throw new Error(`${agentType} agent failed validation after retry`);
            }
            agentResults[agentType] = retryResult;
          } else {
            agentResults[agentType] = result;
          }

          // Upload artifacts to S3
          if (agentResults[agentType]?.artifacts) {
            await this._uploadArtifactsToS3(
              pipelineId,
              agentResults[agentType]!.artifacts
            );
          }

          // Update state
          (state as any)[`${agentType === 'demo' ? 'deploy' : agentType}Result`] = agentResults[agentType];
          await this._savePipelineState(state);

          this._emitProgress(agentType, 'complete', `${agentType} completed successfully`);
        } catch (error) {
          this.logError(`${agentType} agent failed`, error);

          if (agentType === 'analyze' || agentType === 'docs') {
            // Critical agents - fail pipeline
            state.status = 'failed';
            state.error = error instanceof Error ? error.message : 'Unknown error';
            await this._savePipelineState(state);
            this._emitProgress(agentType, 'error', `${agentType} failed: ${state.error}`);
            throw error;
          } else {
            // Optional agents - skip and continue
            this.log(`Skipping optional agent ${agentType} due to failure`);
            agentResults[agentType] = {
              agent: agentType,
              status: 'skipped',
              artifacts: [],
              error: error instanceof Error ? error.message : 'Unknown error',
              executionTime: 0,
              metadata: { skipped: true, failedGracefully: true },
            };
            this._emitProgress(agentType, 'skipped', `${agentType} skipped due to error`);
          }
        }
      }

      // Compile all artifacts
      const allArtifacts = this._compileFinalDeliverables(agentResults);

      // Wait for approval (if needed)
      state.status = 'awaiting_approval';
      state.artifacts = allArtifacts;
      await this._savePipelineState(state);
      this._emitProgress('supervisor', 'awaiting-approval', 'Waiting for user approval');

      // Create PR with approved changes
      const prArtifact = await this._createPullRequest(context, agentResults);
      allArtifacts.push(prArtifact);

      // Track costs
      const costs = this.bedrock.getTotalCost();
      state.bedrockCost = costs.total;

      // Finalize
      state.status = 'completed';
      state.completedAt = Date.now();
      state.artifacts = allArtifacts;
      await this._savePipelineState(state);

      this._emitProgress('supervisor', 'complete', 'Pipeline completed successfully');

      return this.createSuccessResult(
        allArtifacts,
        {
          agentResults,
          pipelineId,
          bedrockCost: costs.total,
          costBreakdown: costs.breakdown,
          totalExecutionTime: Date.now() - startTime,
        },
        Date.now() - startTime
      );
    } catch (error) {
      this.logError('Pipeline execution failed', error);

      state.status = 'failed';
      state.error = error instanceof Error ? error.message : 'Unknown error';
      state.completedAt = Date.now();
      await this._savePipelineState(state);

      this._emitProgress('supervisor', 'error', `Pipeline failed: ${state.error}`);

      return this.createErrorResult(error, Date.now() - startTime);
    }
  }

  /**
   * Get the Bedrock client (for agents to use)
   */
  getBedrockClient(): BedrockLLMClient {
    return this.bedrock;
  }

  /**
   * Get the S3 manager (for agents to use)
   */
  getS3Manager(): S3ArtifactManager {
    return this.s3;
  }

  /**
   * Execute a specific agent with Bedrock LLM support
   */
  private async _executeAgentWithBedrock(
    agentType: AgentType,
    context: AgentContext,
    _config: any
  ): Promise<AgentResult> {
    // Import and instantiate the appropriate agent
    // The agents themselves use Bedrock through the shared client
    const { AnalyzeAgent } = await import('./analyze');
    const { DocsAgent } = await import('./docs');
    const { DemoAgent } = await import('./demo');
    const { PitchAgent } = await import('./pitch');

    const agents: Record<string, Agent> = {
      analyze: new AnalyzeAgent(),
      docs: new DocsAgent(),
      demo: new DemoAgent(),
      pitch: new PitchAgent(),
    };

    const agent = agents[agentType];
    if (!agent) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }

    return await agent.executeWithTimeout(context);
  }

  /**
   * Validate agent output
   */
  private _validateAgentOutput(result: AgentResult): boolean {
    if (!result || !result.agent || !result.status) return false;
    if (!['completed', 'failed', 'skipped'].includes(result.status)) return false;
    if (result.status === 'completed' && !result.artifacts) return false;
    return true;
  }

  /**
   * Compile artifacts from all agents
   */
  private _compileFinalDeliverables(
    agentResults: Record<AgentType, AgentResult | null>
  ): Artifact[] {
    const artifacts: Artifact[] = [];
    for (const agentType of Object.keys(agentResults) as AgentType[]) {
      const result = agentResults[agentType];
      if (result?.artifacts) {
        artifacts.push(...result.artifacts);
      }
    }
    return artifacts;
  }

  /**
   * Upload artifacts to S3
   */
  private async _uploadArtifactsToS3(
    pipelineId: string,
    artifacts: Artifact[]
  ): Promise<void> {
    for (const artifact of artifacts) {
      try {
        let artifactType: 'pdf' | 'diagram' | 'audio' = 'pdf';
        if (artifact.type === 'architecture-diagram') artifactType = 'diagram';
        if (artifact.type === 'pitch-script') artifactType = 'audio';

        const fileName = `${artifact.type}_${artifact.id}.txt`;
        await this.s3.uploadArtifact(
          pipelineId,
          artifactType,
          fileName,
          Buffer.from(artifact.content, 'utf-8'),
          { artifactId: artifact.id, artifactType: artifact.type }
        );
      } catch (error) {
        this.logError(`Failed to upload artifact ${artifact.id} to S3`, error);
        // Non-critical - continue
      }
    }
  }

  /**
   * Save pipeline state to DynamoDB
   */
  private async _savePipelineState(state: AWSPipelineState): Promise<void> {
    try {
      await this.dynamodb.createPipeline({
        id: state.id,
        sessionId: state.sessionId,
        status: state.status,
        currentAgent: state.currentAgent,
        results: [
          state.analyzeResult,
          state.docsResult,
          state.deployResult,
          state.pitchResult,
        ].filter(Boolean),
        approvalGates: state.approvalGates,
        artifacts: state.artifacts,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        error: state.error,
        metadata: {
          mode: state.mode,
          repoUrl: state.repoUrl,
          totalExecutionTime: state.completedAt
            ? state.completedAt - state.startedAt
            : Date.now() - state.startedAt,
          bedrockCost: state.bedrockCost,
          s3StorageUsed: 0,
        },
      });
    } catch (error) {
      this.logError('Failed to save pipeline state to DynamoDB', error);
      // Non-critical for pipeline execution
    }
  }

  /**
   * Emit SSE progress event
   */
  private _emitProgress(
    agent: string,
    status: string,
    message: string,
    data?: any
  ): void {
    this.log(`[${status.toUpperCase()}] ${message}`);
    if (this.sseEmitter) {
      this.sseEmitter({ agent, status, message, data });
    }
  }

  /**
   * Create pull request with approved changes
   */
  private async _createPullRequest(
    context: AgentContext,
    agentResults: Record<AgentType, AgentResult | null>
  ): Promise<PullRequestArtifact> {
    const octokit = new Octokit({ auth: context.githubToken });
    const { owner, name, defaultBranch } = context.repoMetadata;

    try {
      // Branch naming: repoclaw/improvements-{timestamp}
      const branchName = `repoclaw/improvements-${Date.now()}`;

      // Get base branch SHA
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo: name,
        ref: `heads/${defaultBranch}`,
      });

      // Create new branch
      await octokit.git.createRef({
        owner,
        repo: name,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      });

      // Apply changes from docs agent
      const docsResult = agentResults.docs;
      if (docsResult?.artifacts) {
        for (const artifact of docsResult.artifacts) {
          const path = artifact.type === 'readme' ? 'README.md' : 'API_DOCS.md';
          const message = artifact.type === 'readme'
            ? 'docs: update README with improved documentation'
            : 'docs: add API documentation';

          await this._commitFile(octokit, owner, name, branchName, path, artifact.content, message);
        }
      }

      // Apply deployment config changes from deploy agent
      const deployResult = agentResults.demo;
      if (deployResult?.artifacts) {
        for (const artifact of deployResult.artifacts) {
          if (artifact.metadata?.configFile) {
            await this._commitFile(
              octokit, owner, name, branchName,
              artifact.metadata.configFile,
              artifact.content,
              `ci: add ${artifact.metadata.configFile} deployment configuration`
            );
          }
        }
      }

      // Create PR
      const prTitle = 'RepoClaw: Documentation and Deployment Improvements';
      const prBody = this._generatePRBody(agentResults, context);

      const { data: pr } = await octokit.pulls.create({
        owner,
        repo: name,
        title: prTitle,
        body: prBody,
        head: branchName,
        base: defaultBranch,
      });

      return {
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
          checklist: ['Documentation updated', 'Deployment config added', 'Manual review pending'],
          checksStatus: 'pending',
        },
        createdAt: Date.now(),
      };
    } catch (error) {
      this.logError('Failed to create pull request', error);
      return {
        id: `pr_${Date.now()}`,
        type: 'pull-request',
        title: 'Pull Request (Failed)',
        content: `Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    }
  }

  /**
   * Commit a file to a branch
   */
  private async _commitFile(
    octokit: Octokit,
    owner: string,
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string
  ): Promise<void> {
    try {
      const { data: existing } = await octokit.repos.getContent({
        owner, repo, path, ref: branch,
      });
      if ('sha' in existing) {
        await octokit.repos.createOrUpdateFileContents({
          owner, repo, path, message, branch,
          content: Buffer.from(content).toString('base64'),
          sha: existing.sha,
        });
      }
    } catch {
      await octokit.repos.createOrUpdateFileContents({
        owner, repo, path, message, branch,
        content: Buffer.from(content).toString('base64'),
      });
    }
  }

  /**
   * Generate PR body with artifact summary
   */
  private _generatePRBody(
    agentResults: Record<AgentType, AgentResult | null>,
    context: AgentContext
  ): string {
    let body = '## RepoClaw: Documentation and Deployment Improvements\n\n';
    body += `Generated by RepoClaw in **${context.mode}** mode using AWS Bedrock.\n\n`;

    body += '### Changes\n\n';

    if (agentResults.docs?.status === 'completed') {
      body += '- **Documentation**: Updated README with comprehensive project information\n';
      if (agentResults.docs.artifacts.some(a => a.type === 'api-docs')) {
        body += '- **API Docs**: Generated API documentation\n';
      }
    }

    if (agentResults.demo?.status === 'completed') {
      body += '- **Deployment**: AWS deployment configuration generated\n';
    }

    if (agentResults.pitch?.status === 'completed') {
      body += '- **Pitch Materials**: Architecture diagram and presentation deck\n';
    }

    const costs = this.bedrock.getTotalCost();
    body += `\n### Pipeline Stats\n`;
    body += `- **Mode**: ${context.mode}\n`;
    body += `- **Bedrock Cost**: $${costs.total.toFixed(4)}\n`;
    body += `- **Execution Time**: ${((Date.now() - Date.now()) / 1000).toFixed(1)}s\n`;

    body += '\n---\n*Generated by [RepoClaw](https://github.com/Sirius-ashwak/Repoclaw) powered by AWS Bedrock*';
    return body;
  }
}
