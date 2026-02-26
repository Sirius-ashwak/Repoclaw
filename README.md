# RepoClaw

> Transform GitHub repositories into production-ready portfolios with AI-powered multi-agent orchestration.

RepoClaw is an intelligent workspace that automatically generates documentation, deploys live demos, and creates pitch materials for your GitHub projects. Built for developers, students, and hackathon participants who want to showcase their work professionally without spending hours on documentation and deployment.

## Features

### Multi-Agent System
- **Automated Analysis**: Detects tech stack, identifies documentation gaps, and analyzes code structure
- **Smart Documentation**: Generates comprehensive README files with setup instructions, usage examples, and API docs
- **Live Deployments**: Automatically deploys demos to Vercel with QR codes for mobile access
- **Pitch Materials**: Creates architecture diagrams, presentation slides, and pitch scripts

### Workflow Modes
Choose the optimization mode that fits your goal:
- **Hackathon Mode**: Prioritizes demo deployment and compelling pitch materials
- **Placement Mode**: Focuses on professional documentation and code quality presentation
- **Refactor Mode**: Emphasizes code improvements and maintainability suggestions

### Real-Time Experience
- Live progress tracking with Server-Sent Events
- Visual pipeline status for each agent
- Interactive diff viewer for reviewing changes
- Approval workflow before applying changes

### GitHub Integration
- OAuth authentication for secure access
- Automatic pull request creation with approved changes
- Preserves your repository structure and history
- Detailed PR descriptions with change summaries

## Quick Start

### Prerequisites

- Node.js 18 or higher
- GitHub account
- Vercel account (for deployments)

### Installation

```bash
# Clone the repository
git clone https://github.com/Sirius-ashwak/Repoclaw.git
cd repoclaw

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Configuration

Create a `.env` file with the following variables:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/callback

# Vercel
VERCEL_TOKEN=your_vercel_api_token
VERCEL_TEAM_ID=your_vercel_team_id (optional)

# LLM API (Grok or OpenAI-compatible)
LLM_API_KEY=your_llm_api_key
LLM_API_BASE_URL=https://api.x.ai/v1
LLM_MODEL=grok-beta

# Vercel KV (provided automatically when deployed to Vercel)
KV_URL=your_kv_url
KV_REST_API_URL=your_kv_rest_api_url
KV_REST_API_TOKEN=your_kv_rest_api_token
KV_REST_API_READ_ONLY_TOKEN=your_kv_rest_api_read_only_token

# Optional: Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

See [SETUP.md](SETUP.md) for detailed configuration instructions.

### Development

```bash
# Start the development server
npm run dev

# Open http://localhost:3000
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## How It Works

RepoClaw uses a multi-agent architecture where specialized AI agents work together:

1. **AnalyzeAgent**: Scans your repository to detect the tech stack, identify documentation gaps, and analyze code structure
2. **DocsAgent**: Generates comprehensive documentation including README improvements and API documentation
3. **DemoAgent**: Configures and deploys your project to Vercel, creating a live demo with QR code access
4. **PitchAgent**: Creates presentation materials including architecture diagrams, slide decks, and pitch scripts
5. **SupervisorAgent**: Orchestrates the entire pipeline, manages agent coordination, and creates pull requests

All agents communicate through a shared state stored in Vercel KV, with real-time progress updates streamed to your browser via Server-Sent Events.

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **AI/LLM**: Vercel AI SDK with Grok (or OpenAI-compatible APIs)
- **Agent Orchestration**: Custom multi-agent system
- **APIs**: GitHub (Octokit), Vercel Deployment API
- **Storage**: Vercel KV (Redis)
- **Testing**: Jest + fast-check for property-based testing

## Project Structure

```
repoclaw/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # API routes (pipeline, auth, export)
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Landing page
│   │   └── globals.css     # Global styles
│   ├── components/         # React components
│   │   ├── RepoInputForm.tsx
│   │   ├── ProgressBoard.tsx
│   │   ├── DiffViewer.tsx
│   │   └── ...
│   ├── agents/            # AI agent implementations
│   │   ├── base.ts        # Base agent class
│   │   ├── analyze.ts     # Repository analysis
│   │   ├── docs.ts        # Documentation generation
│   │   ├── demo.ts        # Deployment automation
│   │   ├── pitch.ts       # Pitch material creation
│   │   └── supervisor.ts  # Pipeline orchestration
│   ├── lib/               # Utilities and configurations
│   │   ├── kv.ts          # Vercel KV operations
│   │   ├── github.ts      # GitHub API utilities
│   │   ├── config.ts      # Mode configurations
│   │   └── ...
│   └── types/             # TypeScript definitions
│       └── index.ts
├── .kiro/                 # Project specifications
│   └── specs/
├── package.json
├── tsconfig.json
└── README.md
```

## API Routes

### Pipeline Management
- `POST /api/pipeline/start` - Initialize a new pipeline execution
- `GET /api/pipeline/stream` - Stream real-time progress updates (SSE)

### Repository Connection
- `POST /api/repo/connect` - Connect a GitHub repository
- `GET /api/auth/callback` - GitHub OAuth callback handler

### Approval & Export
- `POST /api/approval/respond` - Approve or reject proposed changes
- `POST /api/export` - Export artifacts (PDF, PR link, Telegram)

### Session Management
- `POST /api/session/cleanup` - Clean up expired sessions

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Configure environment variables in the Vercel dashboard
4. Deploy

Vercel automatically provisions KV storage and provides the necessary credentials.

### Environment Variables

Required variables for production:
- GitHub OAuth credentials (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)
- Vercel API token (`VERCEL_TOKEN`)
- LLM API credentials (`LLM_API_KEY`, `LLM_API_BASE_URL`)
- Vercel KV credentials (auto-provided by Vercel)

Optional:
- `TELEGRAM_BOT_TOKEN` for Telegram export functionality
- `VERCEL_TEAM_ID` if deploying under a team account

## Testing

RepoClaw includes comprehensive test coverage:

- **Property-Based Tests**: 29 properties tested with fast-check (100+ iterations each)
- **Unit Tests**: 110+ test cases covering all components and utilities
- **Integration Tests**: End-to-end pipeline execution tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- agents
npm test -- components
npm test -- lib

# Run with coverage
npm test -- --coverage
```

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

Please read the specification files in `.kiro/specs/repoclaw/` for detailed requirements and design documentation.

## Documentation

- [SETUP.md](SETUP.md) - Detailed setup and configuration guide
- [PROGRESS.md](PROGRESS.md) - Development progress and completed features
- [.kiro/specs/repoclaw/](/.kiro/specs/repoclaw/) - Complete project specifications

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/Sirius-ashwak/Repoclaw/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Sirius-ashwak/Repoclaw/discussions)

## Acknowledgments

Built with modern web technologies and AI-powered automation to help developers showcase their work effectively.

---

Made with care for developers, by developers
