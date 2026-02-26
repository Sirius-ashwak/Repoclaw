# RepoClaw Phase 2: AWS Integration - Design Document

**Feature Name:** repoclaw-aws-phase2  
**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Draft

---

## Overview

This design document outlines the technical architecture for RepoClaw Phase 2, a comprehensive AWS-powered agentic AI workspace that transforms GitHub repositories into launch-ready project portfolios in under 5 minutes. The system addresses a critical problem: developers (especially in Tier-2/3 India) have decent code but lack time, infrastructure, or communication skills for documentation, demos, and pitches.

The Phase 2 enhancement introduces a complete LangGraph-based multi-agent system with eight key areas:

1. **LangGraph Multi-Agent Orchestration** - Supervisor agent coordinating AnalyzeAgent, DocsAgent, DeployAgent, and PitchAgent
2. **AWS Cloud Infrastructure** - DynamoDB for sessions, S3 for artifacts, Lambda for sandboxed execution
3. **Amazon Bedrock LLM Integration** - Claude 3.5 Sonnet for complex tasks, Llama 3 for simple tasks
4. **Vernacular Language Support** - AWS Translate and Polly for 5 Indian languages (Hindi, Tamil, Telugu, Bengali, Marathi)
5. **Three Specialized Modes** - Hackathon (complete launch package), Placement (interview materials), Refactor (code quality)
6. **AWS Deployment Automation** - Auto-generate Amplify and SAM configurations with validation
7. **Hybrid Bandwidth Architecture** - Offline fallback with local Ollama LLM for Tier-2/3 cities
8. **Visual Diff and Approval Workflow** - Monaco-based diff viewer with per-file accept/reject controls

The design emphasizes AWS-native services, cost optimization (<$0.50 per pipeline), security through Lambda sandboxes, and comprehensive testing with property-based tests.

### Design Principles

- **AWS-Native First**: Prefer AWS services over third-party alternatives for all infrastructure
- **Bharat-Optimized**: Design for Indian market constraints (bandwidth, language, cost)
- **Agent-Driven Architecture**: LangGraph orchestration with specialized agents for each concern
- **Streaming-First**: Real-time feedback via Server-Sent Events for all long-running operations
- **Mode-Based Workflows**: Three distinct modes (Hackathon, Placement, Refactor) with tailored outputs
- **Graceful Degradation**: Offline mode with Ollama fallback for Tier-2/3 cities
- **Cost-Conscious**: Intelligent model selection to optimize for <$0.50 per pipeline execution
- **Security-First**: Lambda sandboxes, encrypted storage, time-limited URLs, input validation

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14 + Tailwind + shadcn/ui)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Landing Page │  │ Mode Selector│  │ Language     │  │ Offline Mode    │ │
│  │ (Hero + Form)│  │ (3 modes)    │  │ Selector (6) │  │ Indicator       │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────────────┤
│  │              Dashboard (3-Panel Layout)                                   │
│  │  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  │ Left Panel  │  │ Center Panel     │  │ Right Panel              │   │
│  │  │ - Pipeline  │  │ - Monaco Diff    │  │ - Artifact Cards         │   │
│  │  │   Status    │  │ - Logs/Preview   │  │ - Download Buttons       │   │
│  │  │ - Agent     │  │ - Accept/Reject  │  │ - Demo URL               │   │
│  │  │   Progress  │  │   Controls       │  │ - PDF/Audio/Diagram      │   │
│  │  └─────────────┘  └──────────────────┘  └──────────────────────────┘   │
│  └──────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (SSE for streaming)
┌─────────────────────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js API Routes)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ /api/        │  │ /api/        │  │ /api/        │  │ /api/           │ │
│  │ pipeline/    │  │ approval/    │  │ export       │  │ auth/callback   │ │
│  │ start        │  │ respond      │  │              │  │ (GitHub OAuth)  │ │
│  │ /stream      │  │              │  │              │  │                 │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LangGraph Multi-Agent System                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Supervisor Agent                                 │   │
│  │  - Orchestrates agent sequence: Analyze → Docs → Deploy → Pitch → PR │   │
│  │  - Manages pipeline state transitions                                │   │
│  │  - Emits SSE events for progress tracking                            │   │
│  │  - Handles approval gates and user feedback                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│           │              │              │              │                     │
│           ▼              ▼              ▼              ▼                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ AnalyzeAgent │ │ DocsAgent    │ │ DeployAgent  │ │ PitchAgent   │      │
│  │ - Repo scan  │ │ - README gen │ │ - Amplify    │ │ - 6-slide    │      │
│  │ - Linting    │ │ - API docs   │ │   config     │ │   deck       │      │
│  │ - Structure  │ │ - Comments   │ │ - SAM        │ │ - Mermaid    │      │
│  │   analysis   │ │ - STAR       │ │   template   │ │   diagram    │      │
│  │              │ │   stories    │ │ - Validation │ │ - Audio      │      │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AWS Services Layer                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ DynamoDB     │  │ S3 Bucket    │  │ Bedrock      │  │ Lambda          │ │
│  │ - Sessions   │  │ - Artifacts  │  │ - Claude 3.5 │  │ - Code          │ │
│  │   (24h TTL)  │  │ - Pre-signed │  │   Sonnet     │  │   Sandboxes     │ │
│  │ - Pipeline   │  │   URLs (1h)  │  │ - Llama 3    │  │ - 5min timeout  │ │
│  │   State      │  │ - 7-day      │  │ - Streaming  │  │ - 1GB memory    │ │
│  │ - Atomic     │  │   cleanup    │  │ - Cost track │  │ - Isolated      │ │
│  │   Updates    │  │              │  │              │  │                 │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Translate    │  │ Polly        │  │ Amplify      │  │ CloudWatch      │ │
│  │ - 5 Indian   │  │ - Neural     │  │ - Auto       │  │ - Logs          │ │
│  │   languages  │  │   voices     │  │   Deploy     │  │ - Metrics       │ │
│  │ - Tech term  │  │ - MP3 output │  │ - CI/CD      │  │ - Alarms        │ │
│  │   preserve   │  │ - 30-60s     │  │              │  │                 │ │
│  │ - S3 cache   │  │   duration   │  │              │  │                 │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Offline Fallback Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Ollama LLM   │  │ IndexedDB    │  │ Service      │  │ Connectivity    │ │
│  │ - Llama 3    │  │ - Cache      │  │ Worker       │  │ Detection       │ │
│  │ - CodeLlama  │  │   (10 max)   │  │ - Sync queue │  │ - Auto switch   │ │
│  │ - Local      │  │ - Artifacts  │  │ - Background │  │ - <200ms        │ │
│  │   inference  │  │ - Offline    │  │   sync       │  │                 │ │
│  │              │  │   viewing    │  │              │  │                 │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      External Services                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ GitHub API (Octokit)                                                  │   │
│  │ - OAuth authentication                                                │   │
│  │ - Repository operations (clone, branch, commit, PR)                  │   │
│  │ - Branch naming: repoclaw/improvements-{timestamp}                   │   │
│  │ - PR title: "RepoClaw: Documentation and Deployment Improvements"    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

**Online Mode - Hackathon Workflow (Happy Path)**:
1. User submits repository URL, selects Hackathon mode, chooses Hindi language
2. Frontend calls `/api/pipeline/start` with session ID and preferences
3. API creates session in DynamoDB with 24-hour TTL
4. Supervisor agent initializes LangGraph state machine
5. **AnalyzeAgent** executes:
   - Clones repository to Lambda sandbox
   - Runs linting tools (ESLint/Pylint)
   - Analyzes structure, detects stack (Next.js, React, etc.)
   - Emits progress via SSE: "Analyzing repository structure..."
6. **DocsAgent** executes:
   - Generates README with Problem, Solution, Tech Stack, Setup, Usage sections
   - Extracts API endpoints and generates documentation
   - Uses Bedrock Claude 3.5 for complex generation
   - Emits progress via SSE: "Generating documentation..."
7. **DeployAgent** executes:
   - Detects Next.js project
   - Generates `amplify.yml` with correct build commands
   - Validates configuration syntax
   - Uploads config to S3, generates pre-signed URL
   - Emits progress via SSE: "Creating deployment configuration..."
8. **PitchAgent** executes:
   - Generates 6-slide deck (Title, Problem, Solution, Architecture, Demo, Impact)
   - Creates Mermaid architecture diagram
   - Generates 30-60 second pitch script
   - Uses AWS Translate to translate script to Hindi
   - Uses AWS Polly (Aditi voice) to generate MP3 audio
   - Uploads PDF, PNG, MP3 to S3
   - Emits progress via SSE: "Generating pitch materials..."
9. Supervisor presents all artifacts in diff viewer for approval
10. User reviews changes, accepts README and deployment config
11. Supervisor creates GitHub branch `repoclaw/improvements-{timestamp}`
12. Commits accepted changes with descriptive messages
13. Creates PR with title "RepoClaw: Documentation and Deployment Improvements"
14. Returns demo URL, artifact download links, PR URL

**Offline Mode (Degraded)**:
1. Service Worker detects network failure (ping to AWS fails)
2. Frontend switches to offline mode indicator (orange badge)
3. User submits repository URL (local analysis only)
4. Offline Manager checks for Ollama installation
5. If Ollama available:
   - Uses Llama 3 for basic linting and formatting
   - Generates simplified README (no API docs)
   - Skips deployment config and pitch materials
   - Caches results in IndexedDB
6. If Ollama not available:
   - Displays installation instructions
   - Queues pipeline for execution when online
7. When connectivity restored:
   - Service Worker detects online status
   - Automatically syncs cached results to DynamoDB/S3
   - Re-runs pipeline with full AWS services

**Placement Mode Workflow**:
1. User selects Placement mode
2. Supervisor configures agents for interview preparation
3. **AnalyzeAgent**: Extracts commit history, feature implementations
4. **DocsAgent**: 
   - Generates resume-style README (concise, metrics-focused)
   - Creates 3-5 STAR-format stories from commits
   - Generates 10-15 interview Q&A about the project
   - Extracts technical skills and technologies
5. **PitchAgent**: Generates 2-minute technical walkthrough script
6. Skips DeployAgent (not needed for placement)
7. Presents materials for approval and export

**Refactor Mode Workflow**:
1. User selects Refactor mode
2. Supervisor configures agents for code quality
3. **AnalyzeAgent**:
   - Runs comprehensive linting (ESLint, Pylint, etc.)
   - Detects deep nesting, long functions, duplicate code
   - Identifies missing comments and documentation
   - Generates file organization suggestions
4. **DocsAgent**:
   - Generates inline comments for complex functions
   - Creates missing documentation files
5. Presents refactoring suggestions in diff viewer
6. User accepts/rejects each suggestion
7. Creates PR with approved refactoring changes

### LangGraph Agent Orchestration

The system uses LangGraph to implement a state machine-based multi-agent workflow. The Supervisor agent coordinates four specialized agents in a sequential pipeline.

**State Machine Design**:

```typescript
// LangGraph state definition
interface PipelineState {
  sessionId: string;
  repoUrl: string;
  mode: 'hackathon' | 'placement' | 'refactor';
  language: SupportedLanguage;
  
  // Agent outputs
  analyzeResult: AnalyzeResult | null;
  docsResult: DocsResult | null;
  deployResult: DeployResult | null;
  pitchResult: PitchResult | null;
  
  // Workflow control
  currentAgent: AgentType | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  approvalGates: ApprovalGate[];
  error: string | null;
  
  // Metadata
  startedAt: number;
  completedAt: number | null;
  artifacts: Artifact[];
}

// Agent sequence graph
const workflow = new StateGraph<PipelineState>()
  .addNode('analyze', analyzeAgent)
  .addNode('docs', docsAgent)
  .addNode('deploy', deployAgent)
  .addNode('pitch', pitchAgent)
  .addNode('approval', approvalGate)
  .addNode('pr', prCreationAgent)
  .addEdge('analyze', 'docs')
  .addEdge('docs', 'deploy')
  .addEdge('deploy', 'pitch')
  .addEdge('pitch', 'approval')
  .addConditionalEdges('approval', shouldCreatePR, {
    approved: 'pr',
    rejected: 'pitch', // Allow re-generation
  })
  .addEdge('pr', END);
```

**Agent Responsibilities**:

| Agent | Input | Output | Bedrock Model | Typical Duration |
|-------|-------|--------|---------------|------------------|
| AnalyzeAgent | Repository URL | Stack detection, linting results, structure analysis | Llama 3 | 15-20s |
| DocsAgent | Analyze results | README, API docs, comments, STAR stories | Claude 3.5 | 25-30s |
| DeployAgent | Stack detection | Amplify config, SAM template, validation results | Claude 3.5 | 40-45s |
| PitchAgent | All previous results | Slides, diagram, script, audio | Claude 3.5 + Translate + Polly | 55-60s |

**Supervisor Agent Logic**:

```typescript
class SupervisorAgent {
  async orchestrate(initialState: PipelineState): Promise<PipelineState> {
    let state = initialState;
    
    // Execute agent sequence
    for (const agentType of ['analyze', 'docs', 'deploy', 'pitch']) {
      state.currentAgent = agentType;
      await this.updateDynamoDB(state);
      
      // Emit SSE event
      this.emitProgress({
        agent: agentType,
        status: 'in-progress',
        message: `Executing ${agentType}...`,
      });
      
      try {
        // Execute agent with timeout
        const result = await this.executeAgent(agentType, state);
        state = { ...state, [`${agentType}Result`]: result };
        
        this.emitProgress({
          agent: agentType,
          status: 'complete',
          message: `${agentType} completed successfully`,
        });
      } catch (error) {
        state.status = 'failed';
        state.error = error.message;
        this.emitProgress({
          agent: agentType,
          status: 'error',
          message: `${agentType} failed: ${error.message}`,
        });
        throw error;
      }
    }
    
    // Wait for user approval
    state.status = 'awaiting_approval';
    await this.waitForApproval(state);
    
    // Create PR with approved changes
    if (state.approvalGates.some(g => g.approved)) {
      await this.createPullRequest(state);
    }
    
    state.status = 'completed';
    state.completedAt = Date.now();
    return state;
  }
  
  private async executeAgent(
    agentType: AgentType,
    state: PipelineState
  ): Promise<AgentResult> {
    const agent = this.agents[agentType];
    const context = this.buildContext(state);
    
    // Select Bedrock model based on agent complexity
    const complexity = this.getAgentComplexity(agentType);
    const model = complexity === 'complex' ? 'claude-3.5' : 'llama-3';
    
    return await agent.execute(context, model);
  }
}
```

**Mode-Based Agent Configuration**:

```typescript
// Agent behavior varies by mode
const modeConfigs = {
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
    analyze: { linting: true, deepAnalysis: true, duplicateDetection: true },
    docs: { inlineComments: true, missingDocs: true },
    deploy: { skip: true },
    pitch: { skip: true },
  },
};
```

**State Persistence and Recovery**:

- Pipeline state stored in DynamoDB after each agent completes
- Atomic updates using optimistic locking (version field)
- If pipeline crashes, can resume from last completed agent
- Partial results preserved for user review even on failure

### AWS Service Selection Rationale

| Service | Purpose | Alternative Considered | Why AWS |
|---------|---------|------------------------|---------|
| DynamoDB | Session storage | Redis, Vercel KV | Native AWS, auto-scaling, TTL support |
| S3 | Artifact storage | Vercel Blob, Cloudflare R2 | Pre-signed URLs, lifecycle policies, cost |
| Bedrock | LLM inference | OpenAI, Anthropic direct | AWS-native, Mumbai region, cost control |
| Lambda | Code sandboxes | ECS, Fargate | Fast cold start, pay-per-use, isolated |
| Translate | Vernacular | Google Translate API | AWS-native, batch support, custom glossary |
| Polly | Audio generation | ElevenLabs, Google TTS | AWS-native, neural voices, SSML support |
| Amplify | Deployment | Manual CloudFormation | Auto-detection, CI/CD integration |

---

## Components and Interfaces

### 1. DynamoDB Session Manager

Replaces `src/lib/kv.ts` with AWS DynamoDB operations.

**Responsibilities**:
- Store session data with 24-hour TTL
- Store pipeline state with atomic updates
- Store approval gates with 1-hour TTL
- Handle concurrent updates with optimistic locking

**Interface**:

```typescript
// src/lib/aws/dynamodb.ts

export interface DynamoDBConfig {
  region: string;
  tableName: string;
  endpoint?: string; // For local testing
}

export class DynamoDBSessionManager {
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;
  
  constructor(config: DynamoDBConfig);
  
  // Session operations
  async createSession(session: Session): Promise<void>;
  async getSession(sessionId: string): Promise<Session | null>;
  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void>;
  async deleteSession(sessionId: string): Promise<void>;
  
  // Pipeline operations
  async createPipeline(pipeline: PipelineState): Promise<void>;
  async getPipeline(pipelineId: string): Promise<PipelineState | null>;
  async updatePipeline(pipelineId: string, updates: Partial<PipelineState>): Promise<void>;
  async deletePipeline(pipelineId: string): Promise<void>;
  
  // Approval gate operations
  async createApprovalGate(gate: ApprovalGate): Promise<void>;
  async getApprovalGate(gateId: string): Promise<ApprovalGate | null>;
  async updateApprovalGate(gateId: string, updates: Partial<ApprovalGate>): Promise<void>;
  async deleteApprovalGate(gateId: string): Promise<void>;
  
  // Utility
  async cleanupExpiredSessions(): Promise<number>;
}
```

**DynamoDB Table Schema**:

```typescript
// Primary table: repoclaw-sessions
{
  PK: string;           // "SESSION#<sessionId>" | "PIPELINE#<pipelineId>" | "APPROVAL#<gateId>"
  SK: string;           // "METADATA" | "STATE" | "GATE"
  EntityType: string;   // "session" | "pipeline" | "approval"
  TTL: number;          // Unix timestamp for auto-deletion
  Data: object;         // Session | PipelineState | ApprovalGate
  CreatedAt: number;
  UpdatedAt: number;
  Version: number;      // For optimistic locking
}

// GSI: EntityType-CreatedAt-index
// Allows querying all sessions or pipelines by creation time
```

### 2. S3 Artifact Manager

Replaces Vercel Blob with S3 for artifact storage.

**Responsibilities**:
- Upload PDFs, diagrams, audio files to S3
- Generate pre-signed URLs with 1-hour expiration
- Organize files by pipeline ID and artifact type
- Implement lifecycle policies for auto-cleanup

**Interface**:

```typescript
// src/lib/aws/s3.ts

export interface S3Config {
  region: string;
  bucketName: string;
  urlExpiration: number; // seconds
}

export class S3ArtifactManager {
  private client: S3Client;
  
  constructor(config: S3Config);
  
  async uploadArtifact(
    pipelineId: string,
    artifactType: 'pdf' | 'diagram' | 'audio',
    fileName: string,
    content: Buffer | Uint8Array,
    metadata?: Record<string, string>
  ): Promise<string>; // Returns S3 key
  
  async getPresignedUrl(key: string): Promise<string>;
  
  async deleteArtifact(key: string): Promise<void>;
  
  async listArtifacts(pipelineId: string): Promise<Array<{
    key: string;
    size: number;
    lastModified: Date;
    url: string;
  }>>;
  
  async cleanupOldArtifacts(daysOld: number): Promise<number>;
}

// S3 bucket structure:
// repoclaw-artifacts/
//   <pipelineId>/
//     pdfs/
//       README.pdf
//       API_DOCS.pdf
//     diagrams/
//       architecture.png
//     audio/
//       pitch_en.mp3
//       pitch_hi.mp3
```

### 3. Bedrock LLM Client

Replaces generic LLM calls with Amazon Bedrock.

**Responsibilities**:
- Route requests to Claude 3.5 Sonnet or Llama 3 based on complexity
- Handle streaming responses for real-time feedback
- Implement rate limiting and retry logic
- Track costs per pipeline execution

**Interface**:

```typescript
// src/lib/aws/bedrock.ts

export interface BedrockConfig {
  region: string;
  models: {
    complex: string;  // "anthropic.claude-3-5-sonnet-20240620-v1:0"
    simple: string;   // "meta.llama3-70b-instruct-v1:0"
  };
}

export type TaskComplexity = 'simple' | 'complex';

export class BedrockLLMClient {
  private client: BedrockRuntimeClient;
  
  constructor(config: BedrockConfig);
  
  async invoke(
    prompt: string,
    complexity: TaskComplexity,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stopSequences?: string[];
    }
  ): Promise<string>;
  
  async invokeStream(
    prompt: string,
    complexity: TaskComplexity,
    onChunk: (chunk: string) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<void>;
  
  selectModel(complexity: TaskComplexity): string;
  
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    model: string
  ): number;
}

// Task complexity mapping:
// - simple: Summarization, formatting, basic Q&A (Llama 3)
// - complex: Code generation, analysis, refactoring (Claude 3.5)
```

### 4. Lambda Sandbox Executor

Executes untrusted code in isolated Lambda environments.

**Responsibilities**:
- Spin up ephemeral Lambda functions for code analysis
- Run `npm test`, `npm run lint`, security checks
- Stream results back to main application
- Enforce 5-minute timeout and resource limits

**Interface**:

```typescript
// src/lib/aws/lambda-sandbox.ts

export interface SandboxConfig {
  region: string;
  functionName: string;
  timeout: number; // milliseconds
}

export interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  error?: string;
}

export class LambdaSandboxExecutor {
  private client: LambdaClient;
  
  constructor(config: SandboxConfig);
  
  async executeCode(
    repoUrl: string,
    commands: string[],
    environment?: Record<string, string>
  ): Promise<SandboxResult>;
  
  async runTests(repoUrl: string): Promise<SandboxResult>;
  
  async runLinter(repoUrl: string): Promise<SandboxResult>;
  
  async runSecurityScan(repoUrl: string): Promise<SandboxResult>;
}

// Lambda function payload:
{
  repoUrl: string;
  commands: string[];
  environment: Record<string, string>;
  timeout: number;
}
```

### 5. Translation Service

Integrates AWS Translate and Polly for vernacular support.

**Responsibilities**:
- Translate documentation to Hindi, Tamil, Telugu, Bengali, Marathi
- Preserve technical terms and code snippets
- Generate audio pitches using Polly neural voices
- Cache translations in S3 for reuse

**Interface**:

```typescript
// src/lib/aws/translation.ts

export type SupportedLanguage = 'hi' | 'ta' | 'te' | 'bn' | 'mr' | 'en';

export interface TranslationConfig {
  region: string;
  customTerminologyName?: string;
}

export class TranslationService {
  private translateClient: TranslateClient;
  private pollyClient: PollyClient;
  private s3Manager: S3ArtifactManager;
  
  constructor(config: TranslationConfig);
  
  async translateDocument(
    content: string,
    sourceLang: SupportedLanguage,
    targetLang: SupportedLanguage,
    preserveCodeBlocks: boolean = true
  ): Promise<string>;
  
  async generateAudioPitch(
    script: string,
    language: SupportedLanguage,
    voiceId?: string
  ): Promise<Buffer>; // MP3 audio
  
  async getCachedTranslation(
    contentHash: string,
    targetLang: SupportedLanguage
  ): Promise<string | null>;
  
  async cacheTranslation(
    contentHash: string,
    targetLang: SupportedLanguage,
    translation: string
  ): Promise<void>;
  
  // Technical term preservation
  private extractCodeBlocks(content: string): Array<{ index: number; content: string }>;
  private restoreCodeBlocks(translated: string, blocks: Array<{ index: number; content: string }>): string;
}

// Voice mapping for Polly:
const VOICE_MAP: Record<SupportedLanguage, string> = {
  hi: 'Aditi',      // Hindi (Neural)
  ta: 'Kajal',      // Tamil (Neural) - if available, else standard
  te: 'Kajal',      // Telugu (use Tamil voice as fallback)
  bn: 'Aditi',      // Bengali (use Hindi voice as fallback)
  mr: 'Aditi',      // Marathi (use Hindi voice as fallback)
  en: 'Joanna',     // English (Neural)
};
```

### 6. Amplify Config Generator

Generates AWS Amplify and SAM deployment configurations.

**Responsibilities**:
- Detect project type (Next.js, React, Vue, Angular, serverless)
- Generate `amplify.yml` or `template.yaml` based on detection
- Inject environment variable placeholders
- Validate configurations before PR creation

**Interface**:

```typescript
// src/lib/aws/amplify-generator.ts

export type ProjectType = 'nextjs' | 'react' | 'vue' | 'angular' | 'express' | 'fastify' | 'koa';

export interface ProjectDetectionResult {
  type: ProjectType;
  framework: string;
  buildCommand: string;
  outputDir: string;
  hasServerless: boolean;
}

export class AmplifyConfigGenerator {
  async detectProjectType(repoPath: string): Promise<ProjectDetectionResult>;
  
  async generateAmplifyConfig(detection: ProjectDetectionResult): Promise<string>;
  
  async generateSAMTemplate(detection: ProjectDetectionResult): Promise<string>;
  
  async validateConfig(configContent: string, type: 'amplify' | 'sam'): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
  
  async simulateDeployment(configContent: string): Promise<{
    success: boolean;
    issues: string[];
    fixes: Array<{ issue: string; fix: string }>;
  }>;
}

// Example amplify.yml template:
/*
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
*/
```

### 7. Offline Mode Manager

Handles offline fallback with local Ollama LLM and IndexedDB caching.

**Responsibilities**:
- Detect network connectivity status
- Switch between Bedrock and Ollama based on connectivity
- Cache pipeline results in IndexedDB
- Sync cached data when connection restored

**Interface**:

```typescript
// src/lib/offline/manager.ts

export interface OfflineConfig {
  ollamaEndpoint: string; // http://localhost:11434
  ollamaModel: string;    // llama3 or codellama
  maxCachedResults: number;
}

export class OfflineManager {
  private isOnline: boolean;
  private ollamaClient: OllamaClient;
  private cache: IndexedDBCache;
  
  constructor(config: OfflineConfig);
  
  async checkConnectivity(): Promise<boolean>;
  
  async executePipeline(
    context: AgentContext,
    mode: 'online' | 'offline'
  ): Promise<PipelineState>;
  
  async cacheResult(pipelineId: string, result: PipelineState): Promise<void>;
  
  async getCachedResult(pipelineId: string): Promise<PipelineState | null>;
  
  async syncPendingResults(): Promise<number>; // Returns count of synced results
  
  // Ollama integration
  async checkOllamaInstallation(): Promise<boolean>;
  async downloadOllamaModel(model: string): Promise<void>;
}

// IndexedDB schema:
// Database: repoclaw-offline
// Store: pipeline-results
{
  pipelineId: string;
  result: PipelineState;
  timestamp: number;
  synced: boolean;
}
```

### 8. Deployment Orchestrator

Handles one-click AWS deployment with validation.

**Responsibilities**:
- Scan for missing AWS configurations
- Validate IAM roles, environment variables, S3 buckets
- Trigger deployment via AWS CLI or SDK
- Monitor deployment progress and handle rollbacks

**Interface**:

```typescript
// src/lib/aws/deployment.ts

export interface DeploymentConfig {
  region: string;
  stackName: string;
  templatePath: string;
  parameters: Record<string, string>;
}

export interface DeploymentValidation {
  missingIAMRoles: string[];
  missingEnvVars: string[];
  invalidS3Configs: string[];
  missingLambdaPermissions: string[];
  fixes: Array<{ issue: string; fix: string; code: string }>;
}

export class DeploymentOrchestrator {
  private cfnClient: CloudFormationClient;
  private iamClient: IAMClient;
  
  async validateDeployment(config: DeploymentConfig): Promise<DeploymentValidation>;
  
  async deploy(
    config: DeploymentConfig,
    onProgress: (status: string) => void
  ): Promise<{
    success: boolean;
    stackId: string;
    outputs: Record<string, string>;
    url?: string;
  }>;
  
  async rollback(stackId: string): Promise<void>;
  
  async getDeploymentStatus(stackId: string): Promise<{
    status: 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | 'ROLLBACK';
    events: Array<{ timestamp: Date; message: string }>;
  }>;
}
```

---

## Data Models

### DynamoDB Data Models

**Session Entity**:
```typescript
interface DynamoDBSession {
  PK: string;              // "SESSION#<sessionId>"
  SK: string;              // "METADATA"
  EntityType: 'session';
  TTL: number;             // Unix timestamp (24 hours from creation)
  Data: {
    id: string;
    repoUrl: string;
    repoMetadata: RepoMetadata | null;
    githubToken: string;   // Encrypted
    selectedMode: Mode | null;
    pipelineId: string | null;
    language: SupportedLanguage;
    createdAt: number;
    expiresAt: number;
  };
  Version: number;
  CreatedAt: number;
  UpdatedAt: number;
}
```

**Pipeline Entity**:
```typescript
interface DynamoDBPipeline {
  PK: string;              // "PIPELINE#<pipelineId>"
  SK: string;              // "STATE"
  EntityType: 'pipeline';
  TTL: number;             // Unix timestamp (24 hours from creation)
  Data: {
    id: string;
    sessionId: string;
    status: PipelineStatus;
    currentAgent: AgentType | null;
    results: AgentResult[];
    approvalGates: ApprovalGate[];
    artifacts: Artifact[];
    startedAt: number;
    completedAt: number | null;
    error: string | null;
    metadata: {
      mode: Mode;
      repoUrl: string;
      totalExecutionTime: number;
      bedrockCost: number;
      s3StorageUsed: number;
    };
  };
  Version: number;
  CreatedAt: number;
  UpdatedAt: number;
}
```

### S3 Data Models

**Artifact Metadata** (stored as S3 object tags):
```typescript
interface S3ArtifactMetadata {
  pipelineId: string;
  artifactType: 'pdf' | 'diagram' | 'audio';
  language: SupportedLanguage;
  generatedBy: AgentType;
  createdAt: string; // ISO 8601
  expiresAt: string; // ISO 8601 (7 days from creation)
}
```

**Translation Cache** (S3 object key structure):
```
repoclaw-translations/
  <contentHash>/
    hi.json
    ta.json
    te.json
    bn.json
    mr.json
```

### Bedrock Request/Response Models

**Bedrock Invoke Request**:
```typescript
interface BedrockInvokeRequest {
  modelId: string;
  contentType: 'application/json';
  accept: 'application/json';
  body: string; // JSON stringified
}

// Body structure for Claude 3.5:
{
  anthropic_version: "bedrock-2023-05-31";
  max_tokens: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  stop_sequences?: string[];
}

// Body structure for Llama 3:
{
  prompt: string;
  max_gen_len: number;
  temperature?: number;
  top_p?: number;
}
```

**Bedrock Invoke Response**:
```typescript
interface BedrockInvokeResponse {
  contentType: 'application/json';
  body: Uint8Array; // JSON stringified
}

// Body structure for Claude 3.5:
{
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Body structure for Llama 3:
{
  generation: string;
  prompt_token_count: number;
  generation_token_count: number;
  stop_reason: 'stop' | 'length';
}
```

### Offline Cache Models

**IndexedDB Pipeline Cache**:
```typescript
interface CachedPipeline {
  pipelineId: string;
  sessionId: string;
  result: PipelineState;
  artifacts: Array<{
    type: string;
    name: string;
    content: Blob; // For offline viewing
  }>;
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
  lastSyncAttempt: number | null;
}
```

### Configuration Models

**AWS Configuration**:
```typescript
interface AWSConfig {
  region: string;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  services: {
    dynamodb: {
      tableName: string;
      endpoint?: string;
    };
    s3: {
      bucketName: string;
      urlExpiration: number;
    };
    bedrock: {
      models: {
        complex: string;
        simple: string;
      };
    };
    lambda: {
      sandboxFunctionName: string;
      timeout: number;
    };
    translate: {
      customTerminologyName?: string;
    };
    polly: {
      voiceMap: Record<SupportedLanguage, string>;
    };
  };
}
```

**Deployment Configuration**:
```typescript
interface DeploymentConfig {
  type: 'amplify' | 'sam';
  projectType: ProjectType;
  buildSettings: {
    buildCommand: string;
    outputDir: string;
    environmentVariables: Record<string, string>;
  };
  awsSettings: {
    region: string;
    stackName: string;
    customDomain?: string;
  };
  validation: {
    requiredEnvVars: string[];
    requiredIAMRoles: string[];
    requiredPermissions: string[];
  };
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all 20 requirements with 140+ acceptance criteria, I identified several redundant properties that were consolidated:

**Consolidated Properties**:
- Pipeline timing (1.1 + 1.4) → Property 1: First output within 5 seconds
- Mode-specific artifacts (2.2, 2.3, 2.4) → Property 3: Mode-based artifact completeness
- Model selection (8.2 + 8.3) → Property 11: Intelligent model selection
- Technical term preservation (5.6 + 9.3 + 9.4) → Property 18: Technical content preservation in translation
- Bedrock usage when online (7.2 + 8.1) → Property 10: Online mode uses Bedrock
- Agent status updates (1.3 + 12.2 + 12.3) → Property 4: Real-time status emission
- Artifact display (12.5 + 12.6) → Property 35: Artifact card display
- Environment variable validation (4.3.2 + 6.1.2) → Property 26: Deployment validation

The following 50 properties represent unique, testable behaviors across all requirements:

### Property 1: Pipeline First Output Timing

*For any* pipeline execution, the first visible output SHALL appear within 5 seconds of initiation.

**Validates: Requirements 1.1, 1.4, 14.1**

### Property 2: Agent Execution Sequence

*For any* pipeline execution, agents SHALL execute in exact order: AnalyzeAgent → DocsAgent → DeployAgent → PitchAgent → PR creation, without skipping any agent.

**Validates: Requirements 1.2**

### Property 3: Mode-Based Artifact Completeness

*For any* pipeline execution in Hackathon mode, all 5 artifacts (README, demo URL, architecture diagram, 6-slide deck, pitch audio) SHALL be generated.  
*For any* pipeline execution in Placement mode, all required artifacts (resume-style README, 3-5 STAR stories, 10-15 Q&A) SHALL be generated.  
*For any* pipeline execution in Refactor mode, all required artifacts (lint suggestions, layout recommendations, code comments, documentation) SHALL be generated.

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 4: Real-Time Status Emission

*For any* agent completion, a status update SHALL be emitted via Server-Sent Events and displayed in the dashboard within 500ms.

**Validates: Requirements 1.3, 12.2, 12.3**

### Property 5: Pipeline State Consistency

*For any* pipeline execution with agents A → B → C, when agent B completes, agent C SHALL receive the complete output from agent B without data loss.

**Validates: Requirements 1.6**

### Property 6: Documentation Structure Completeness

*For any* repository, the generated README SHALL contain all required sections: Problem, Solution, Tech Stack, Setup, Usage, Screenshots.

**Validates: Requirements 3.1**

### Property 7: Documentation Round-Trip Preservation

*For any* generated documentation in Markdown format, parsing then regenerating SHALL produce semantically equivalent content.

**Validates: Requirements 3.6**

### Property 8: Project Stack Detection

*For any* project of type Next.js, React, Vue, Node.js, Express, Python Flask, or FastAPI, the DeployAgent SHALL correctly identify the project type.

**Validates: Requirements 4.1**

### Property 9: Amplify Configuration Validity

*For any* detected frontend project, the generated `amplify.yml` SHALL pass AWS Amplify validation and contain correct build commands for that project type.

**Validates: Requirements 4.2**

### Property 10: Online Mode Uses Bedrock

*For any* AI operation when network connectivity is available, the system SHALL use AWS Bedrock (not Ollama).

**Validates: Requirements 7.2, 8.1**

### Property 11: Intelligent Model Selection

*For any* task classified as simple (summarization, formatting), the system SHALL use Llama 3.  
*For any* task classified as complex (code generation, analysis, architecture design), the system SHALL use Claude 3.5 Sonnet.

**Validates: Requirements 8.2, 8.3**

### Property 12: Bedrock Streaming Responses

*For any* Bedrock API call, response chunks SHALL arrive progressively (streaming) rather than all at once.

**Validates: Requirements 8.4**

### Property 13: Bedrock Retry with Exponential Backoff

*For any* failed Bedrock API call, the system SHALL retry up to 3 times with exponential backoff delays (1s, 2s, 4s).

**Validates: Requirements 8.5**

### Property 14: Bedrock to Ollama Fallback

*For any* Bedrock API call where all 3 retries fail, the system SHALL fall back to Ollama if available.

**Validates: Requirements 8.6**

### Property 15: Cost Tracking Per Pipeline

*For any* pipeline execution, the total Bedrock cost SHALL be calculated based on input/output tokens and stored in pipeline metadata.

**Validates: Requirements 8.7**

### Property 16: Multi-Language Translation Support

*For any* content and target language (Hindi, Tamil, Telugu, Bengali, Marathi), AWS Translate SHALL successfully translate the content.

**Validates: Requirements 9.1, 9.2**

### Property 17: Translation Caching

*For any* translated content, subsequent requests for the same content hash and target language SHALL retrieve the cached translation from S3 without calling AWS Translate again.

**Validates: Requirements 9.5**

### Property 18: Technical Content Preservation in Translation

*For any* translation, technical terms (API, function, class, variable names) SHALL remain in English, and code blocks SHALL remain unchanged.

**Validates: Requirements 5.6, 9.3, 9.4**

### Property 19: Translation Round-Trip Semantic Accuracy

*For any* technical documentation, translating to a regional language then back to English SHALL preserve technical accuracy of terms and code snippets.

**Validates: Requirements 9.7**

### Property 20: Polly Audio Generation

*For any* pitch script in Hindi, Tamil, or English, AWS Polly SHALL generate MP3 audio with duration between 30 and 60 seconds using the appropriate neural voice.

**Validates: Requirements 5.3, 5.5, 9.6**

### Property 21: Pitch Deck Slide Count

*For any* generated pitch deck, the deck SHALL contain exactly 6 slides with titles: Title, Problem, Solution, Architecture, Demo, Impact.

**Validates: Requirements 5.1, 5.7**

### Property 22: Mermaid Diagram Validity

*For any* generated Mermaid architecture diagram, the diagram SHALL render without syntax errors and include all detected major components (frontend, backend, database, external services).

**Validates: Requirements 5.2, 17.6**

### Property 23: Diff Viewer Approval Idempotence

*For any* file change in the diff viewer, accepting then rejecting then accepting again SHALL result in the file being included in the final PR (last action wins).

**Validates: Requirements 6.7**

### Property 24: PR Creation with Accepted Changes Only

*For any* set of reviewed changes, the created GitHub pull request SHALL contain only the accepted changes, excluding all rejected changes.

**Validates: Requirements 6.6**

### Property 25: GitHub Branch Naming Pattern

*For any* approved changes, the system SHALL create a new branch with naming pattern `repoclaw/improvements-{timestamp}`.

**Validates: Requirements 13.3**

### Property 26: Deployment Configuration Validation

*For any* generated Amplify or SAM configuration, validation SHALL identify syntax errors, missing required fields, missing IAM roles, and missing environment variables.

**Validates: Requirements 4.5, 4.3.2, 6.1.1, 6.1.2**

### Property 27: Deployment Verification Round-Trip

*For any* valid deployment configuration, deploying to AWS then validating SHALL confirm successful deployment with a functional demo URL.

**Validates: Requirements 4.7, 4.8**

### Property 28: Network Connectivity Detection

*For any* network state change (online ↔ offline), the connectivity check SHALL detect the change and switch modes within 200ms.

**Validates: Requirements 7.1, 7.5**

### Property 29: Offline Fallback to Ollama

*For any* AI operation when network connectivity is unavailable, the system SHALL route the request to local Ollama LLM.

**Validates: Requirements 7.3**

### Property 30: Online Sync After Offline

*For any* cached pipeline result in IndexedDB, when network connectivity is restored, the result SHALL automatically sync to DynamoDB and S3.

**Validates: Requirements 7.5, 5.1.5, 5.3.5**

### Property 31: Ollama Installation Detection

*For any* system, the offline manager SHALL correctly detect whether Ollama is installed and available at the configured endpoint.

**Validates: Requirements 5.2.1**

### Property 32: DynamoDB Session Persistence with TTL

*For any* session created in DynamoDB, the session SHALL be retrievable before 24 hours have elapsed and SHALL be automatically deleted after 24 hours.

**Validates: Requirements 10.1**

### Property 33: DynamoDB Atomic Updates

*For any* pipeline state, when multiple concurrent updates occur, the final state SHALL be consistent and reflect all updates without data loss (optimistic locking).

**Validates: Requirements 10.2**

### Property 34: DynamoDB Write-Read Persistence

*For any* session data written to DynamoDB, immediately reading the session SHALL return data identical to what was written.

**Validates: Requirements 10.8**

### Property 35: S3 Storage Integrity

*For any* artifact uploaded to S3, downloading via pre-signed URL SHALL return content byte-for-byte identical to the uploaded content.

**Validates: Requirements 10.3, 10.9**

### Property 36: S3 Pre-Signed URL Expiration

*For any* S3 pre-signed URL generated at time T, accessing at T+59 minutes SHALL succeed, and accessing at T+61 minutes SHALL fail with access denied.

**Validates: Requirements 10.4**

### Property 37: S3 Lifecycle Cleanup

*For any* artifact uploaded at time T, checking at time T+8 days SHALL find the artifact deleted by lifecycle policy.

**Validates: Requirements 10.5**

### Property 38: Lambda Sandbox Execution

*For any* repository with test, lint, or security check commands, the Lambda sandbox SHALL execute them and return results with stdout, stderr, and exit code within 5 minutes.

**Validates: Requirements 10.6, 20.4**

### Property 39: Lambda Sandbox Isolation

*For any* code attempting unauthorized operations (network access to non-AWS services, file system writes), the Lambda sandbox SHALL terminate execution and log the attempt.

**Validates: Requirements 20.2, 20.3, 20.6**

### Property 40: GitHub URL Validation

*For any* invalid GitHub URL submitted via the Launch button, validation SHALL fail before pipeline initiation with a descriptive error message.

**Validates: Requirements 11.4**

### Property 41: Artifact Card Display

*For any* generated artifact (PDF, audio, diagram, demo URL), the dashboard SHALL display a card with download button and preview option.

**Validates: Requirements 12.5, 12.6**

### Property 42: Pipeline Completion Timing

*For any* typical repository (< 1000 files, < 100K LOC), the pipeline SHALL complete end-to-end execution in under 5 minutes.

**Validates: Requirements 14.2**

### Property 43: Agent-Specific Timing

*For any* pipeline execution, DocsAgent SHALL complete within 30 seconds, DeployAgent within 45 seconds, and PitchAgent within 60 seconds.

**Validates: Requirements 14.3, 14.4, 14.5**

### Property 44: Linting Improvement

*For any* code with linting errors in Refactor mode, running lint, applying suggested fixes, then running lint again SHALL show reduced error count.

**Validates: Requirements 15.7**

### Property 45: STAR Story Generation Count

*For any* pipeline execution in Placement mode, the system SHALL generate between 3 and 5 STAR-format stories.

**Validates: Requirements 16.3**

### Property 46: Interview Q&A Generation Count

*For any* pipeline execution in Placement mode, the system SHALL generate between 10 and 15 interview questions about the project.

**Validates: Requirements 16.4**

### Property 47: Export File Size Optimization

*For any* exported artifact, the file size SHALL meet optimization constraints: PDF <5MB, audio <2MB, PNG <1MB.

**Validates: Requirements 18.7**

### Property 48: Download All ZIP Completeness

*For any* "Download All" operation, the created ZIP archive SHALL contain all generated artifacts for the pipeline.

**Validates: Requirements 18.6**

### Property 49: Error Message Specificity

*For any* agent failure, the system SHALL display a specific error message with suggested fixes and provide a "Retry" button.

**Validates: Requirements 19.1, 19.2**

### Property 50: Partial Result Preservation on Failure

*For any* pipeline that fails at agent N, outputs from agents 1 through N-1 SHALL remain accessible for user review.

**Validates: Requirements 19.7**

---

## Error Handling

### Error Categories

**1. AWS Service Errors**
- DynamoDB throttling, conditional check failures
- S3 access denied, bucket not found
- Bedrock rate limiting, model unavailable
- Lambda timeout, out of memory
- Translate/Polly service errors

**2. Network Errors**
- Connection timeout
- DNS resolution failure
- SSL/TLS errors
- Offline mode detection

**3. Validation Errors**
- Invalid session data
- Malformed pipeline state
- Invalid deployment configuration
- Missing required fields

**4. Business Logic Errors**
- Session expired
- Pipeline already running
- Unsupported project type
- Translation cache miss

### Error Handling Strategies

**Retry with Exponential Backoff**:
```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation errors
      if (error instanceof ValidationError) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
```

**Graceful Degradation**:
```typescript
async function executeWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  onFallback?: () => void
): Promise<T> {
  try {
    return await primary();
  } catch (error) {
    console.warn('Primary operation failed, using fallback:', error);
    onFallback?.();
    return await fallback();
  }
}
```

**Circuit Breaker Pattern**:
```typescript
class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

### Error Response Format

All API errors follow a consistent format:

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: any;          // Additional context
    retryable: boolean;     // Whether client should retry
    fallbackAvailable: boolean; // Whether offline mode can help
  };
  requestId: string;        // For debugging
  timestamp: number;
}

// Example error codes:
// - SESSION_EXPIRED
// - DYNAMODB_THROTTLED
// - S3_ACCESS_DENIED
// - BEDROCK_RATE_LIMITED
// - LAMBDA_TIMEOUT
// - TRANSLATION_FAILED
// - NETWORK_OFFLINE
// - VALIDATION_ERROR
```

### Logging and Monitoring

**CloudWatch Logs Integration**:
- All AWS service calls logged with request/response
- Error stack traces captured
- Performance metrics (latency, token usage, costs)
- User actions tracked for analytics

**Metrics to Track**:
- DynamoDB read/write latency (p50, p95, p99)
- S3 upload/download times
- Bedrock token usage and costs per pipeline
- Lambda execution times and cold starts
- Translation cache hit rate
- Offline mode usage frequency

---

## Testing Strategy

### Dual Testing Approach

This project requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
**Property Tests**: Verify universal properties across all inputs

Together, these approaches provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Property-Based Testing Configuration

**Library Selection**: We will use `fast-check` for JavaScript/TypeScript property-based testing.

**Configuration Requirements**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: repoclaw-aws-phase2, Property {number}: {property_text}`

**Example Property Test**:
```typescript
import fc from 'fast-check';

// Feature: repoclaw-aws-phase2, Property 1: DynamoDB Session Persistence with TTL
describe('DynamoDB Session Persistence', () => {
  it('should persist sessions and auto-delete after 24 hours', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          repoUrl: fc.webUrl(),
          githubToken: fc.string({ minLength: 40, maxLength: 40 }),
        }),
        async (sessionData) => {
          const manager = new DynamoDBSessionManager(testConfig);
          
          // Create session
          const session = {
            ...sessionData,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          };
          
          await manager.createSession(session);
          
          // Should be retrievable immediately
          const retrieved = await manager.getSession(session.id);
          expect(retrieved).toEqual(session);
          
          // TTL should be set correctly
          expect(retrieved.TTL).toBeGreaterThan(Date.now() / 1000);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing Strategy

**Test Coverage Goals**:
- 80% code coverage minimum
- 100% coverage for critical paths (session management, artifact storage)
- All error handling paths tested

**Unit Test Categories**:

1. **AWS Service Integration Tests**:
   - DynamoDB CRUD operations
   - S3 upload/download with pre-signed URLs
   - Bedrock model invocation and streaming
   - Lambda sandbox execution
   - Translate and Polly API calls

2. **Business Logic Tests**:
   - Model selection based on task complexity
   - Translation caching logic
   - Offline mode detection and switching
   - Project type detection
   - Config generation and validation

3. **Error Handling Tests**:
   - Retry logic with exponential backoff
   - Circuit breaker state transitions
   - Graceful degradation scenarios
   - Error response formatting

4. **Edge Cases**:
   - Empty or malformed input
   - Network timeouts
   - Rate limiting scenarios
   - Concurrent updates to same resource
   - Cache misses and invalidation

### Integration Testing

**AWS LocalStack**: Use LocalStack for local AWS service emulation during development.

```yaml
# docker-compose.yml for LocalStack
version: '3.8'
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      - SERVICES=dynamodb,s3,lambda,translate,polly
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
    volumes:
      - "./localstack:/tmp/localstack"
```

**Integration Test Scenarios**:
1. End-to-end pipeline execution with all AWS services
2. Offline mode with Ollama fallback
3. Translation and audio generation workflow
4. Deployment config generation and validation
5. Session expiration and cleanup

### Performance Testing

**Load Testing**:
- Simulate 1000 concurrent users
- Measure DynamoDB throughput and latency
- Test S3 upload/download performance
- Verify Bedrock rate limiting handling

**Benchmarks**:
- DynamoDB operations: <100ms (p95)
- S3 uploads (5MB): <2 seconds
- Bedrock streaming: <500ms to first chunk
- Translation: <3 seconds per document
- Polly audio: <5 seconds generation

### Test Data Management

**Generators for Property Tests**:
```typescript
// Custom generators for domain objects
const sessionGenerator = fc.record({
  id: fc.uuid(),
  repoUrl: fc.webUrl({ validSchemes: ['https'] }),
  githubToken: fc.hexaString({ minLength: 40, maxLength: 40 }),
  selectedMode: fc.constantFrom('hackathon', 'placement', 'refactor'),
  language: fc.constantFrom('hi', 'ta', 'te', 'bn', 'mr', 'en'),
});

const pipelineStateGenerator = fc.record({
  id: fc.uuid(),
  sessionId: fc.uuid(),
  status: fc.constantFrom('pending', 'running', 'completed', 'failed'),
  currentAgent: fc.constantFrom('analyze', 'docs', 'demo', 'pitch', null),
});

const artifactGenerator = fc.record({
  type: fc.constantFrom('pdf', 'diagram', 'audio'),
  name: fc.string({ minLength: 5, maxLength: 50 }),
  content: fc.uint8Array({ minLength: 100, maxLength: 1000 }),
});
```

**Mock AWS Services**:
```typescript
// Mock DynamoDB for unit tests
class MockDynamoDBClient {
  private store: Map<string, any> = new Map();
  
  async putItem(params: any): Promise<void> {
    this.store.set(params.Item.PK, params.Item);
  }
  
  async getItem(params: any): Promise<any> {
    return { Item: this.store.get(params.Key.PK) };
  }
}
```

### Testing Checklist

**Before Deployment**:
- [ ] All 44 property tests passing with 100+ iterations
- [ ] Unit test coverage >80%
- [ ] Integration tests passing with LocalStack
- [ ] Performance benchmarks met
- [ ] Error handling tested for all AWS services
- [ ] Offline mode tested with Ollama
- [ ] Translation quality validated for all 5 languages
- [ ] Deployment configs validated for sample projects
- [ ] Security scan passed (no credentials in code)
- [ ] Cost estimation verified (<$0.50 per pipeline)

---

## Implementation Notes

### Migration Path from Phase 1

**Step 1: Add AWS SDK Dependencies**
```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  @aws-sdk/client-bedrock-runtime @aws-sdk/client-lambda \
  @aws-sdk/client-translate @aws-sdk/client-polly \
  @aws-sdk/client-cloudformation @aws-sdk/client-iam
```

**Step 2: Create AWS Configuration**
```typescript
// src/lib/aws/config.ts
export const awsConfig: AWSConfig = {
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  services: {
    dynamodb: {
      tableName: process.env.DYNAMODB_TABLE_NAME || 'repoclaw-sessions',
    },
    s3: {
      bucketName: process.env.S3_BUCKET_NAME || 'repoclaw-artifacts',
      urlExpiration: 3600,
    },
    bedrock: {
      models: {
        complex: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        simple: 'meta.llama3-70b-instruct-v1:0',
      },
    },
    lambda: {
      sandboxFunctionName: 'repoclaw-code-sandbox',
      timeout: 300000,
    },
  },
};
```

**Step 3: Replace Vercel KV with DynamoDB**
```typescript
// Before (Phase 1):
import { kv } from '@vercel/kv';
await kv.set(`session:${sessionId}`, session);

// After (Phase 2):
import { DynamoDBSessionManager } from '@/lib/aws/dynamodb';
const manager = new DynamoDBSessionManager(awsConfig.services.dynamodb);
await manager.createSession(session);
```

**Step 4: Replace Vercel Blob with S3**
```typescript
// Before (Phase 1):
import { put } from '@vercel/blob';
const blob = await put('artifact.pdf', pdfBuffer, { access: 'public' });

// After (Phase 2):
import { S3ArtifactManager } from '@/lib/aws/s3';
const s3 = new S3ArtifactManager(awsConfig.services.s3);
const key = await s3.uploadArtifact(pipelineId, 'pdf', 'artifact.pdf', pdfBuffer);
const url = await s3.getPresignedUrl(key);
```

**Step 5: Integrate Bedrock**
```typescript
// Before (Phase 1):
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${apiKey}` },
  body: JSON.stringify({ model: 'gpt-4', messages }),
});

// After (Phase 2):
import { BedrockLLMClient } from '@/lib/aws/bedrock';
const bedrock = new BedrockLLMClient(awsConfig.services.bedrock);
const response = await bedrock.invoke(prompt, 'complex');
```

### Infrastructure as Code

**DynamoDB Table Creation**:
```yaml
# cloudformation/dynamodb.yaml
Resources:
  RepoClawSessionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: repoclaw-sessions
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
        - AttributeName: EntityType
          AttributeType: S
        - AttributeName: CreatedAt
          AttributeType: N
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE
      GlobalSecondaryIndexes:
        - IndexName: EntityType-CreatedAt-index
          KeySchema:
            - AttributeName: EntityType
              KeyType: HASH
            - AttributeName: CreatedAt
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      TimeToLiveSpecification:
        AttributeName: TTL
        Enabled: true
      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true
      SSESpecification:
        SSEEnabled: true
```

**S3 Bucket Configuration**:
```yaml
# cloudformation/s3.yaml
Resources:
  RepoClawArtifactsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: repoclaw-artifacts
      CorsConfiguration:
        CorsRules:
          - AllowedOrigins:
              - '*'
            AllowedMethods:
              - GET
              - PUT
              - POST
            AllowedHeaders:
              - '*'
            MaxAge: 3600
      LifecycleConfiguration:
        Rules:
          - Id: DeleteOldArtifacts
            Status: Enabled
            ExpirationInDays: 7
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
```

**Lambda Sandbox Function**:
```yaml
# cloudformation/lambda.yaml
Resources:
  CodeSandboxFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: repoclaw-code-sandbox
      Runtime: nodejs20.x
      Handler: index.handler
      Timeout: 300
      MemorySize: 1024
      Role: !GetAtt CodeSandboxRole.Arn
      Environment:
        Variables:
          NODE_ENV: production
      Code:
        ZipFile: |
          // Lambda handler code will be deployed separately
          
  CodeSandboxRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
      Policies:
        - PolicyName: SandboxPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Deny
                Action:
                  - s3:*
                  - dynamodb:*
                  - ec2:*
                Resource: '*'
```

### Security Considerations

**1. Credential Management**:
- Store AWS credentials in AWS Secrets Manager or environment variables
- Never commit credentials to version control
- Use IAM roles for Lambda functions
- Rotate credentials regularly

**2. S3 Pre-signed URL Security**:
- 1-hour expiration enforced
- HTTPS only
- No public bucket access
- Signed with temporary credentials when possible

**3. Lambda Sandbox Isolation**:
- No network access (VPC isolation)
- Deny all AWS service access via IAM
- Resource limits (CPU, memory, timeout)
- Read-only file system except /tmp

**4. DynamoDB Security**:
- Encryption at rest enabled
- Encryption in transit (TLS)
- Fine-grained access control via IAM
- Audit logging with CloudTrail

**5. Bedrock Security**:
- No PII in prompts
- Rate limiting to prevent abuse
- Cost monitoring and alerts
- Request/response logging for audit

### Cost Optimization

**Estimated Costs per 1000 Pipeline Executions**:

| Service | Usage | Cost |
|---------|-------|------|
| DynamoDB | 10K read/write units | $1.25 |
| S3 | 5GB storage, 10K requests | $0.50 |
| Bedrock Claude 3.5 | 500K input + 100K output tokens | $8.25 |
| Bedrock Llama 3 | 1M input + 200K output tokens | $0.60 |
| Lambda | 1000 executions × 5 min × 1GB | $0.83 |
| Translate | 100K characters × 5 languages | $1.50 |
| Polly | 1000 requests × 30 seconds | $0.16 |
| **Total** | | **$13.09** |
| **Per Pipeline** | | **$0.013** |

**Optimization Strategies**:
1. Use Llama 3 for simple tasks (60% cheaper than Claude)
2. Cache translations in S3 (avoid repeat Translate calls)
3. Use DynamoDB on-demand pricing (no idle costs)
4. Set S3 lifecycle policies (auto-delete after 7 days)
5. Optimize Lambda memory allocation (cost vs. speed)
6. Batch Bedrock requests when possible

**Cost Monitoring**:
```typescript
// Track costs per pipeline
interface PipelineCost {
  pipelineId: string;
  dynamodbCost: number;
  s3Cost: number;
  bedrockCost: number;
  lambdaCost: number;
  translateCost: number;
  pollyCost: number;
  totalCost: number;
}
```

### Deployment Strategy

**Phase 2 Rollout Plan**:

1. **Week 1: Infrastructure Setup**
   - Create DynamoDB table
   - Create S3 bucket with policies
   - Deploy Lambda sandbox function
   - Configure Bedrock access

2. **Week 2: Core Migration**
   - Implement DynamoDB session manager
   - Implement S3 artifact manager
   - Implement Bedrock LLM client
   - Write unit tests

3. **Week 3: Vernacular Features**
   - Implement Translation service
   - Implement Polly audio generation
   - Add language selector UI
   - Test all 5 languages

4. **Week 4: Offline Mode**
   - Implement Ollama integration
   - Implement IndexedDB caching
   - Implement sync mechanism
   - Test offline scenarios

5. **Week 5: Deployment Features**
   - Implement Amplify config generator
   - Implement SAM template generator
   - Implement deployment orchestrator
   - Test with sample projects

6. **Week 6: Testing & Polish**
   - Complete property-based tests
   - Integration testing with LocalStack
   - Performance benchmarking
   - Security audit

7. **Week 7: Production Deployment**
   - Deploy to AWS Mumbai region
   - Monitor metrics and costs
   - Gather user feedback
   - Iterate based on feedback

### Monitoring and Observability

**CloudWatch Dashboards**:
```typescript
// Key metrics to monitor
const metrics = {
  // Performance
  'DynamoDB.ReadLatency': { threshold: 100, unit: 'ms' },
  'DynamoDB.WriteLatency': { threshold: 100, unit: 'ms' },
  'S3.UploadTime': { threshold: 2000, unit: 'ms' },
  'Bedrock.TimeToFirstChunk': { threshold: 500, unit: 'ms' },
  
  // Costs
  'Bedrock.TokenUsage': { threshold: 1000000, unit: 'tokens/day' },
  'Lambda.Invocations': { threshold: 10000, unit: 'count/day' },
  'Translate.CharacterCount': { threshold: 1000000, unit: 'chars/day' },
  
  // Errors
  'DynamoDB.ThrottledRequests': { threshold: 10, unit: 'count/hour' },
  'Bedrock.RateLimitErrors': { threshold: 5, unit: 'count/hour' },
  'Lambda.Timeouts': { threshold: 10, unit: 'count/hour' },
  
  // Usage
  'Pipeline.Executions': { unit: 'count/day' },
  'Offline.ModeUsage': { unit: 'count/day' },
  'Translation.Requests': { unit: 'count/day' },
};
```

**Alarms**:
- DynamoDB throttling > 10 requests/hour
- Bedrock cost > $100/day
- Lambda timeout rate > 5%
- S3 upload failure rate > 1%
- Translation error rate > 2%

### Future Enhancements (Out of Scope for Phase 2)

1. **Multi-Region Deployment**
   - Replicate to additional AWS regions
   - Global DynamoDB tables
   - CloudFront CDN for artifacts

2. **Additional Languages**
   - Expand beyond 5 Indian languages
   - Support for other regional languages
   - Custom voice training for Polly

3. **Video Pitch Generation**
   - Use AWS Elemental MediaConvert
   - Combine slides with audio
   - Add subtitles in multiple languages

4. **Real-Time Collaboration**
   - WebSocket support via API Gateway
   - Shared pipeline sessions
   - Live code review features

5. **Custom LLM Fine-Tuning**
   - Fine-tune models on user repositories
   - Domain-specific code generation
   - Personalized recommendations

6. **Advanced Analytics**
   - User behavior tracking
   - A/B testing for features
   - Cost optimization recommendations

---

## Conclusion

This design document provides a comprehensive technical architecture for transforming RepoClaw into an AWS-native, Bharat-first application. The Phase 2 enhancements focus on six key areas: AWS infrastructure migration, Bedrock LLM integration, vernacular language support, auto-deployment features, offline fallback, and enhanced deployment capabilities.

The design emphasizes:
- **AWS-native services** for scalability and reliability
- **Cost optimization** through intelligent model selection
- **Bharat-first features** with 5 Indian language support
- **Offline functionality** for Tier-2/3 cities
- **Security** through Lambda sandboxes and encrypted storage
- **Comprehensive testing** with property-based and unit tests

Implementation will follow a 7-week rollout plan, with continuous monitoring and iteration based on user feedback and AWS AI for Bharat Hackathon criteria.

