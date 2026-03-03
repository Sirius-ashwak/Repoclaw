# RepoClaw

**An agentic AI workspace that transforms GitHub repositories into launch-ready project portfolios in under 5 minutes.**

RepoClaw addresses a critical problem faced by developers -- especially those in resource-constrained environments -- who have functional code but lack the time or tooling for professional documentation, deployment configuration, and pitch preparation. The system uses AWS Bedrock-powered agents to automate these tasks end-to-end, with support for five Indian regional languages and offline operation.

---

## Table of Contents

- [Overview](#overview)
- [Key Capabilities](#key-capabilities)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Workflow Modes](#workflow-modes)
- [AWS Services](#aws-services)
- [Offline Mode](#offline-mode)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

RepoClaw is a Next.js 14 application that orchestrates a pipeline of specialized AI agents to analyze a GitHub repository and produce:

- Comprehensive documentation (README, API docs, inline comments)
- AWS deployment configurations (Amplify, SAM templates)
- Pitch materials (6-slide deck, Mermaid architecture diagram, narrated script)
- Interview preparation materials (STAR stories, Q&A sets)
- A pull request containing all approved changes

The system operates in three modes (Hackathon, Placement, Refactor), supports translation to Hindi, Tamil, Telugu, Bengali, and Marathi via AWS Translate, and includes audio generation via AWS Polly. An offline fallback using local Ollama inference ensures usability under limited connectivity.

---

## Key Capabilities

### Multi-Agent Pipeline
- **AnalyzeAgent** -- Stack detection (Node.js, Python, React, Vue, Angular, Express, Flask, FastAPI), documentation gap analysis, code structure review, commit history extraction
- **DocsAgent** -- README generation with mode-specific sections, API documentation, STAR story generation, interview Q&A (12 questions), resume-style formatting
- **DeployAgent** -- AWS Amplify and SAM template generation, configuration validation, deployment simulation
- **PitchAgent** -- 6-slide presentation (Title, Problem, Solution, Architecture, Demo, Impact), Mermaid diagrams with AWS services, pitch scripts with timing
- **SupervisorAgent** -- Sequential orchestration with DynamoDB state persistence, approval gates, graceful degradation for optional agents

### Vernacular Language Support
- Documentation and pitch scripts translated to Hindi, Tamil, Telugu, Bengali, and Marathi
- Technical terms preserved in English during translation
- Audio pitch generation with AWS Polly neural voices
- Translation caching in S3 to avoid redundant API calls

### Hybrid Bandwidth Architecture
- Online mode uses AWS Bedrock (Claude 3.5 Sonnet for complex tasks, Llama 3 for simple tasks)
- Offline mode falls back to local Ollama with IndexedDB caching
- Automatic connectivity detection with mode switching
- Cached results sync to AWS when connectivity is restored

---

## Architecture

```
Frontend (Next.js 14 + Tailwind CSS + shadcn/ui)
    |
    v  (SSE for real-time streaming)
API Layer (Next.js API Routes)
    |
    v
LangGraph Multi-Agent System
  - SupervisorAgent (orchestration)
  - AnalyzeAgent -> DocsAgent -> DeployAgent -> PitchAgent -> PR
    |
    v
AWS Services Layer
  - DynamoDB (sessions, pipeline state, 24h TTL)
  - S3 (artifacts, pre-signed URLs, 7-day lifecycle)
  - Bedrock (Claude 3.5 Sonnet, Llama 3)
  - Lambda (code sandboxes, 5-min timeout)
  - Translate (5 Indian languages)
  - Polly (neural voice audio)
    |
    v
Offline Fallback Layer
  - Ollama (local LLM inference)
  - IndexedDB (client-side cache)
  - Connectivity detection
```

---

## Prerequisites

- Node.js 18 or higher
- An AWS account with access to Bedrock, DynamoDB, S3, Lambda, Translate, and Polly
- A GitHub OAuth application
- Docker (optional, for LocalStack local development)
- Ollama (optional, for offline mode)

---

## Installation

```bash
git clone https://github.com/Sirius-ashwak/Repoclaw.git
cd repoclaw
npm install
cp .env.example .env
```

---

## Configuration

Edit the `.env` file with your credentials. See `.env.example` for the full list.

### Required Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth application client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth application secret |
| `GITHUB_CALLBACK_URL` | OAuth callback URL (e.g., `http://localhost:3000/api/auth/callback`) |
| `AWS_REGION` | AWS region (default: `ap-south-1`) |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `DYNAMODB_TABLE_NAME` | DynamoDB table name (default: `repoclaw-sessions`) |
| `S3_BUCKET_NAME` | S3 bucket for artifacts (default: `repoclaw-artifacts`) |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `BEDROCK_REGION` | Bedrock region if different from primary region |
| `LAMBDA_SANDBOX_FUNCTION` | Lambda function name for code sandboxing |
| `TRANSLATE_TERMINOLOGY_NAME` | Custom terminology for AWS Translate |
| `OLLAMA_ENDPOINT` | Ollama endpoint for offline mode (default: `http://localhost:11434`) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for export functionality |
| `LOCALSTACK_ENDPOINT` | LocalStack endpoint for local development |

See [SETUP.md](SETUP.md) for detailed configuration instructions.

---

## Usage

```bash
# Start the development server
npm run dev

# Open http://localhost:3000
```

### Local Development with AWS Emulation

```bash
# Start LocalStack and Ollama via Docker
docker-compose up -d

# Set LocalStack endpoint in .env
# LOCALSTACK_ENDPOINT=http://localhost:4566

# Initialize local AWS resources
bash infrastructure/localstack-init.sh

# Start the development server
npm run dev
```

---

## Workflow Modes

### Hackathon Mode
Generates a complete launch package: full README with demo links, AWS Amplify/SAM deployment configurations, 6-slide pitch deck, architecture diagram, and audio pitch script. Designed for time-pressured hackathon submissions.

### Placement Mode
Produces interview-ready materials: resume-style README with project metrics, 3-5 STAR-format interview stories extracted from commit history, 12-question interview Q&A set, and a 2-minute technical walkthrough script. Deployment and pitch agents are skipped.

### Refactor Mode
Focuses on code quality improvements: deep structure analysis (nesting depth, file sizes, missing documentation), lint suggestions, inline comment recommendations, and file organization suggestions. Deployment and pitch agents are skipped.

---

## AWS Services

| Service | Purpose |
|---------|---------|
| **DynamoDB** | Session storage (24h TTL), pipeline state (atomic updates with optimistic locking), approval gates (1h TTL) |
| **S3** | Artifact storage (PDFs, diagrams, audio), pre-signed URLs (1h expiry), 7-day lifecycle cleanup, translation cache |
| **Bedrock** | LLM inference -- Claude 3.5 Sonnet for complex tasks, Llama 3 for simple tasks, with streaming support |
| **Lambda** | Sandboxed code execution for linting, testing, and security scans (5-min timeout, 1GB memory) |
| **Translate** | Document translation to Hindi, Tamil, Telugu, Bengali, Marathi with technical term preservation |
| **Polly** | Neural voice audio generation for pitch scripts in supported languages |

Infrastructure is defined in `infrastructure/cloudformation-template.yaml` and can be deployed using `infrastructure/deploy.sh`.

---

## Offline Mode

When network connectivity is unavailable, RepoClaw automatically switches to offline mode:

- AI operations route to a local Ollama instance (Llama 3 or CodeLlama)
- Pipeline results are cached in the browser's IndexedDB
- When connectivity is restored, cached results sync to DynamoDB and S3
- A visual indicator shows current connectivity status (Online/Offline)

To set up offline mode, install Ollama and pull the required models:

```bash
# Install Ollama from https://ollama.ai
ollama pull llama3
ollama pull codellama
ollama serve
```

---

## API Reference

### Pipeline Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/pipeline/start` | Start a pipeline execution. Accepts `sessionId`, `mode`, and `language`. |
| `GET` | `/api/pipeline/stream` | Stream real-time progress updates via Server-Sent Events. |

### Repository Connection

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/repo/connect` | Submit a GitHub repository URL and initiate OAuth flow. |
| `GET` | `/api/auth/callback` | Handle GitHub OAuth callback and store tokens in DynamoDB. |

### Approval and Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/approval/respond` | Accept or reject proposed changes per file. |
| `POST` | `/api/export` | Export artifacts as PDF, PR link, or via Telegram. |

### Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/session/cleanup` | Remove expired sessions from DynamoDB. |

---

## Project Structure

```
repoclaw/
  src/
    agents/                  # AI agent implementations
      base.ts                  Base agent class with timeout and error handling
      analyze.ts               Repository analysis (stack detection, structure review)
      docs.ts                  Documentation generation (README, API docs, STAR stories)
      demo.ts                  Deployment automation
      pitch.ts                 Pitch materials (6-slide deck, Mermaid diagrams, scripts)
      supervisor.ts            Phase 1 orchestration (Vercel KV)
      aws-supervisor.ts        Phase 2 orchestration (DynamoDB, S3, Bedrock)
    app/
      api/                     Next.js API routes
      page.tsx                 Landing page with language/mode selection
      layout.tsx               Root layout
    components/                React UI components
      LanguageSelector.tsx       Language dropdown (English + 5 Indian languages)
      OfflineModeIndicator.tsx   Online/Offline status indicator
      ProgressBoard.tsx          Pipeline progress visualization
      DiffViewer.tsx             Monaco-based diff viewer
      ModeSelector.tsx           Hackathon/Placement/Refactor selector
    lib/
      aws/                     AWS service clients
        bedrock.ts               Bedrock LLM client (invoke, stream, retry, fallback)
        dynamodb.ts              DynamoDB session manager (CRUD, optimistic locking)
        s3.ts                    S3 artifact manager (upload, pre-signed URLs)
        lambda-sandbox.ts        Lambda sandbox executor (lint, test, security scan)
        translation.ts           AWS Translate + Polly (translation, audio, caching)
        amplify-generator.ts     Amplify/SAM config generation and validation
        cloudwatch-logger.ts     Structured logging and circuit breaker
        config.ts                AWS configuration management
      offline/
        manager.ts               Ollama client, connectivity detection, IndexedDB cache
    types/
      index.ts                 TypeScript type definitions
  infrastructure/
    cloudformation-template.yaml   AWS resource definitions
    deploy.sh                      Deployment script
    localstack-init.sh             LocalStack initialization
  docker-compose.yml               LocalStack + Ollama for local development
```

---

## Testing

The project includes comprehensive test coverage using Jest and fast-check for property-based testing.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm test -- agents
npm test -- lib/aws

# Run with coverage report
npm test -- --coverage
```

### Test Coverage

- **Property-based tests**: 29 properties with 100 iterations each
- **Unit tests**: 110+ test cases across agents, utilities, and components
- **Integration tests**: End-to-end pipeline execution with mocked AWS services

---

## Deployment

### AWS Deployment

1. Deploy the CloudFormation stack:
   ```bash
   bash infrastructure/deploy.sh
   ```

2. Configure environment variables with the stack outputs.

3. Deploy the Next.js application to your hosting provider (Vercel, AWS Amplify, or self-hosted).

### Deploy to Vercel

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Set all required environment variables in the Vercel dashboard.
4. Deploy.

### Cost Estimate

Average cost per pipeline execution is under $0.50, using intelligent model selection (Llama 3 for simple tasks, Claude 3.5 Sonnet for complex tasks).

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make changes and ensure tests pass: `npm test`
4. Commit with a descriptive message: `git commit -m 'Add your feature'`
5. Push and open a pull request.

Refer to the specification files in `.kiro/specs/repoclaw-aws-phase2/` for detailed requirements and design documentation.

---

## Documentation

- [SETUP.md](SETUP.md) -- Installation and configuration guide
- [PROGRESS.md](PROGRESS.md) -- Development progress tracking
- [SYSTEM_VALIDATION.md](SYSTEM_VALIDATION.md) -- System validation report
- [infrastructure/README.md](infrastructure/README.md) -- AWS infrastructure documentation

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Links

- **Repository**: [github.com/Sirius-ashwak/Repoclaw](https://github.com/Sirius-ashwak/Repoclaw)
- **Issues**: [GitHub Issues](https://github.com/Sirius-ashwak/Repoclaw/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Sirius-ashwak/Repoclaw/discussions)
