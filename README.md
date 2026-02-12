# RepoClaw

Transform unpolished GitHub repositories into production-ready deliverables with AI-powered multi-agent orchestration.

## Overview

RepoClaw is a Next.js 14 application that uses specialized AI agents to analyze, document, deploy, and create pitch materials for GitHub repositories. Perfect for students, hackathon participants, and junior developers who need to quickly polish their projects.

## Features

- 🔍 **Automated Analysis**: Detect tech stack, identify issues, and get recommendations
- 📚 **Documentation Generation**: Create professional README and API documentation
- 🚀 **Live Demo Deployment**: Automatic deployment to Vercel with QR codes
- 🎯 **Pitch Materials**: Generate architecture diagrams, slide decks, and scripts
- 🔄 **Supervised PRs**: Review and approve changes before they're applied
- 🎨 **Real-time Progress**: Visual pipeline tracking with SSE updates

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Agent Orchestration**: LangGraph
- **AI**: Vercel AI SDK (Grok)
- **APIs**: GitHub (Octokit), Vercel
- **Storage**: Vercel KV
- **Testing**: Jest + fast-check (property-based testing)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- GitHub OAuth App credentials
- Vercel account and API token
- LLM API key (Grok or OpenAI-compatible)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd repoclaw
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: From your GitHub OAuth App
- `VERCEL_TOKEN`: Your Vercel API token
- `LLM_API_KEY`: Your LLM API key
- `KV_*`: Vercel KV credentials (auto-provided when deployed to Vercel)

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
repoclaw/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/            # API routes
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Home page
│   │   └── globals.css     # Global styles
│   ├── components/         # React components
│   ├── lib/                # Utility functions and configurations
│   │   ├── kv.ts          # Vercel KV utilities
│   │   ├── utils.ts       # General utilities
│   │   └── config.ts      # Mode and agent configurations
│   ├── agents/            # Agent implementations
│   └── types/             # TypeScript type definitions
│       └── index.ts       # Core types and interfaces
├── .kiro/                 # Kiro spec files
│   └── specs/repoclaw/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── README.md
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run property-based tests
npm test -- --testNamePattern="Property"
```

### Building for Production

```bash
npm run build
npm start
```

## Deployment

RepoClaw is designed to be deployed on Vercel:

1. Push your code to GitHub
2. Import the project in Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

Vercel will automatically provide KV storage credentials.

## Modes

RepoClaw supports three optimization modes:

- **Hackathon**: Prioritizes demo deployment and pitch materials
- **Placement**: Focuses on documentation quality and code structure
- **Refactor**: Emphasizes code improvements and maintainability

## Architecture

RepoClaw uses a multi-agent architecture:

1. **AnalyzeAgent**: Detects stack, identifies issues
2. **DocsAgent**: Generates README and API documentation
3. **DemoAgent**: Deploys to Vercel with QR codes
4. **PitchAgent**: Creates diagrams, slides, and scripts
5. **SupervisorAgent**: Orchestrates the pipeline and creates PRs

Agents communicate through a shared pipeline state stored in Vercel KV, with real-time updates via Server-Sent Events (SSE).

## Contributing

Contributions are welcome! Please read the spec files in `.kiro/specs/repoclaw/` for detailed requirements and design documentation.

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
