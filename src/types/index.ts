/**
 * Core TypeScript interfaces for RepoClaw
 * Defines types for agents, artifacts, pipeline state, and session management
 */

// ============================================================================
// Session and Authentication Types
// ============================================================================

export interface Session {
  id: string;
  repoUrl: string;
  repoMetadata: RepoMetadata | null;
  githubToken: string;
  selectedMode: Mode | null;
  pipelineId: string | null;
  createdAt: number;
  expiresAt: number;
}

export interface RepoMetadata {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
}

// ============================================================================
// Mode Types
// ============================================================================

export type Mode = 'hackathon' | 'placement' | 'refactor';

export interface ModeConfig {
  mode: Mode;
  agentPriorities: {
    analyze: number;
    docs: number;
    demo: number;
    pitch: number;
  };
  llmPromptModifiers: {
    emphasis: string;
    tone: string;
    focus: string[];
  };
}

// ============================================================================
// Pipeline State Types
// ============================================================================

export type PipelineStatus = 'initializing' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineState {
  id: string;
  sessionId: string;
  mode: Mode;
  status: PipelineStatus;
  currentAgent: AgentType | null;
  agentResults: Record<AgentType, AgentResult | null>;
  approvalGates: ApprovalGate[];
  artifacts: Artifact[];
  error: PipelineError | null;
  startedAt: number;
  completedAt: number | null;
  timestamps: Record<string, number>;
}

export interface PipelineError {
  agent: AgentType | null;
  message: string;
  details: string;
  timestamp: number;
  recoverable: boolean;
}

// ============================================================================
// Agent Types
// ============================================================================

export type AgentType = 'analyze' | 'docs' | 'demo' | 'pitch' | 'supervisor';

export interface BaseAgent {
  type: AgentType;
  execute(context: AgentContext): Promise<AgentResult>;
}

export interface AgentContext {
  sessionId: string;
  repoMetadata: RepoMetadata;
  githubToken: string;
  mode: Mode;
  previousResults: Record<AgentType, AgentResult | null>;
}

export interface AgentResult {
  agent: AgentType;
  status: AgentStatus;
  artifacts: Artifact[];
  error: string | null;
  executionTime: number;
  metadata: Record<string, any>;
}

// ============================================================================
// Artifact Types
// ============================================================================

export type ArtifactType = 
  | 'analysis'
  | 'readme'
  | 'api-docs'
  | 'demo-url'
  | 'architecture-diagram'
  | 'pitch-deck'
  | 'pitch-script'
  | 'pull-request';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  preview?: string;
  metadata: Record<string, any>;
  createdAt: number;
}

export interface AnalysisArtifact extends Artifact {
  type: 'analysis';
  metadata: {
    stack: StackInfo;
    issues: Issue[];
    recommendations: string[];
  };
}

export interface StackInfo {
  primaryLanguage: string;
  framework: string | null;
  packageManager: 'npm' | 'yarn' | 'pnpm' | null;
  dependencies: string[];
  devDependencies: string[];
  hasTests: boolean;
  hasReadme: boolean;
  hasBuildScript: boolean;
}

export interface Issue {
  type: 'missing_docs' | 'missing_tests' | 'code_structure' | 'unsupported_stack';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: string;
}

export interface DocsArtifact extends Artifact {
  type: 'readme' | 'api-docs';
  metadata: {
    original: string | null;
    generated: string;
    diff: DiffContent;
  };
}

export interface DiffContent {
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface DemoArtifact extends Artifact {
  type: 'demo-url';
  metadata: {
    url: string;
    deploymentId: string;
    qrCode: string; // base64-encoded image
    status: 'deploying' | 'ready' | 'failed';
    logs: string[];
  };
}

export interface PitchArtifact extends Artifact {
  type: 'architecture-diagram' | 'pitch-deck' | 'pitch-script';
  metadata: {
    format: string; // 'mermaid', 'markdown', 'text'
    slides?: PitchSlide[];
  };
}

export interface PitchSlide {
  title: string;
  content: string;
  layout: 'title' | 'content' | 'two-column' | 'image';
}

export interface PullRequestArtifact extends Artifact {
  type: 'pull-request';
  metadata: {
    prNumber: number;
    prUrl: string;
    branch: string;
    title: string;
    body: string;
    checklist: string[];
    checksStatus: 'pending' | 'passing' | 'failing';
  };
}

// ============================================================================
// Approval Gate Types
// ============================================================================

export type ApprovalGateType = 'docs' | 'pull-request';

export type ApprovalGateStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalGate {
  id: string;
  pipelineId: string;
  type: ApprovalGateType;
  status: ApprovalGateStatus;
  artifacts: Artifact[];
  feedback: string | null;
  createdAt: number;
  respondedAt: number | null;
}

// ============================================================================
// SSE Event Types
// ============================================================================

export type SSEEventType = 
  | 'pipeline_started'
  | 'agent_started'
  | 'agent_progress'
  | 'agent_completed'
  | 'agent_failed'
  | 'artifact_generated'
  | 'approval_required'
  | 'approval_responded'
  | 'pipeline_completed'
  | 'pipeline_failed'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  data: any;
  timestamp: number;
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = 'pdf' | 'pr-link' | 'telegram';

export interface ExportRequest {
  pipelineId: string;
  format: ExportFormat;
  options?: {
    telegramChatId?: string;
  };
}

export interface ExportResult {
  format: ExportFormat;
  success: boolean;
  url?: string;
  message: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ConnectRepoRequest {
  repoUrl: string;
}

export interface ConnectRepoResponse {
  sessionId: string;
  requiresAuth: boolean;
  authUrl?: string;
}

export interface StartPipelineRequest {
  sessionId: string;
  mode: Mode;
}

export interface StartPipelineResponse {
  pipelineId: string;
  streamUrl: string;
}

export interface ApprovalResponse {
  gateId: string;
  approved: boolean;
  feedback?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  url: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface TimingInfo {
  startTime: number;
  endTime: number;
  duration: number;
}
