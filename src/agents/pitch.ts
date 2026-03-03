/**
 * PitchAgent
 * Generates pitch materials: architecture diagrams, slide decks, and scripts
 * Phase 2: Strict 6-slide deck, AWS services in diagrams,
 * Placement mode 2-minute walkthrough, translation-ready scripts
 */

import { Agent } from './base';
import { Octokit } from '@octokit/rest';
import type {
  AgentType,
  AgentContext,
  AgentResult,
  PitchArtifact,
  PitchSlide,
} from '@/types';
import { getModeConfig } from '@/lib/config';

export class PitchAgent extends Agent {
  type: AgentType = 'pitch';

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      this.log('Starting pitch material generation');

      const octokit = new Octokit({ auth: context.githubToken });
      const { owner, name } = context.repoMetadata;
      const modeConfig = getModeConfig(context.mode);

      // Analyze repository purpose
      const purpose = await this.analyzeRepositoryPurpose(
        octokit,
        owner,
        name,
        context
      );

      const artifacts: PitchArtifact[] = [];

      // Generate architecture diagram
      const diagramArtifact = await this.generateArchitectureDiagram(
        purpose,
        context
      );
      artifacts.push(diagramArtifact);

      // Generate slide deck
      const slideDeckArtifact = await this.generateSlideDeck(
        purpose,
        context
      );
      artifacts.push(slideDeckArtifact);

      // Generate pitch script
      const scriptArtifact = await this.generatePitchScript(
        purpose,
        context
      );
      artifacts.push(scriptArtifact);

      this.log('Pitch material generation complete', { artifactCount: artifacts.length });

      return this.createSuccessResult(artifacts, {}, Date.now() - startTime);
    } catch (error) {
      this.logError('Pitch material generation failed', error);
      return this.createErrorResult(error, Date.now() - startTime);
    }
  }

  /**
   * Analyze repository purpose and features
   */
  private async analyzeRepositoryPurpose(
    octokit: Octokit,
    owner: string,
    repo: string,
    context: AgentContext
  ): Promise<{
    description: string;
    features: string[];
    techStack: string[];
    keyHighlights: string[];
  }> {
    const { description } = context.repoMetadata;
    
    // Get analysis results
    const analysisResult = context.previousResults?.analyze;
    const stackInfo = analysisResult?.metadata?.stack;

    // Extract features from README if available
    let features: string[] = [];
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'README.md',
      });

      if ('content' in data && data.content) {
        const readme = Buffer.from(data.content, 'base64').toString('utf-8');
        
        // Extract features from README (simple pattern matching)
        const featureSection = readme.match(/##?\s*Features?\s*\n([\s\S]*?)(?=\n##|$)/i);
        if (featureSection) {
          features = featureSection[1]
            .split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
            .map(line => line.replace(/^[-*]\s*/, '').trim())
            .filter(f => f.length > 0);
        }
      }
    } catch (error) {
      this.log('Could not extract features from README');
    }

    // Build tech stack list
    const techStack: string[] = [];
    if (stackInfo?.framework) {
      techStack.push(stackInfo.framework);
    }
    if (stackInfo?.primaryLanguage) {
      techStack.push(stackInfo.primaryLanguage);
    }
    if (stackInfo?.packageManager) {
      techStack.push(stackInfo.packageManager);
    }

    // Generate key highlights based on mode
    const keyHighlights: string[] = [];
    if (context.mode === 'hackathon') {
      keyHighlights.push('Innovative solution to real-world problem');
      keyHighlights.push('Live demo available');
      keyHighlights.push('Modern tech stack');
    } else if (context.mode === 'placement') {
      keyHighlights.push('Production-ready code quality');
      keyHighlights.push('Comprehensive documentation');
      keyHighlights.push('Best practices implementation');
    } else if (context.mode === 'refactor') {
      keyHighlights.push('Improved code structure');
      keyHighlights.push('Enhanced maintainability');
      keyHighlights.push('Technical debt reduction');
    }

    return {
      description: description || `A ${stackInfo?.framework || 'web'} application`,
      features: features.length > 0 ? features : ['Modern web application', 'User-friendly interface', 'Responsive design'],
      techStack,
      keyHighlights,
    };
  }

  /**
   * Generate architecture diagram using Mermaid
   */
  private async generateArchitectureDiagram(
    purpose: any,
    context: AgentContext
  ): Promise<PitchArtifact> {
    const { name } = context.repoMetadata;
    const analysisResult = context.previousResults?.analyze;
    const stackInfo = analysisResult?.metadata?.stack;

    // Generate Mermaid diagram based on stack
    let mermaidCode = '';

    if (stackInfo?.framework === 'Next.js') {
      mermaidCode = `graph TB
    User[User Browser]
    NextJS[Next.js Application]
    API[API Routes]
    DB[(Database)]
    S3[AWS S3 - Artifacts]
    Bedrock[AWS Bedrock - AI]
    DynamoDB[AWS DynamoDB - Sessions]
    
    User -->|HTTP/HTTPS| NextJS
    NextJS -->|Server-Side Rendering| User
    NextJS -->|API Calls| API
    API -->|Queries| DB
    API -->|Storage| S3
    API -->|AI Operations| Bedrock
    API -->|Sessions| DynamoDB
    
    style NextJS fill:#0070f3
    style API fill:#10b981
    style DB fill:#f59e0b
    style S3 fill:#e47911
    style Bedrock fill:#8b5cf6
    style DynamoDB fill:#3b82f6`;
    } else if (stackInfo?.framework === 'React' || stackInfo?.framework === 'Vue' || stackInfo?.framework === 'Angular') {
      mermaidCode = `graph TB
    User[User Browser]
    Frontend[${stackInfo.framework} Application]
    API[Backend API]
    DB[(Database)]
    S3[AWS S3]
    Lambda[AWS Lambda]
    
    User -->|Interactions| Frontend
    Frontend -->|API Requests| API
    API -->|Data| Frontend
    API -->|Queries| DB
    API -->|Files| S3
    API -->|Compute| Lambda
    
    style Frontend fill:#61dafb
    style API fill:#10b981
    style DB fill:#f59e0b
    style S3 fill:#e47911
    style Lambda fill:#f97316`;
    } else if (stackInfo?.framework === 'Flask' || stackInfo?.framework === 'FastAPI') {
      mermaidCode = `graph TB
    Client[Client]
    Gateway[API Gateway]
    App[${stackInfo.framework} App]
    DB[(Database)]
    Lambda[AWS Lambda]
    S3[AWS S3]
    
    Client -->|HTTPS| Gateway
    Gateway -->|Route| App
    App -->|Query| DB
    App -->|Compute| Lambda
    App -->|Storage| S3
    
    style App fill:#3776ab
    style Gateway fill:#e47911
    style DB fill:#f59e0b
    style Lambda fill:#f97316
    style S3 fill:#e47911`;
    } else {
      mermaidCode = `graph TB
    User[User]
    Frontend[Frontend Layer]
    Backend[Backend Layer]
    Data[(Data Layer)]
    AWS[AWS Cloud Services]
    
    User -->|Requests| Frontend
    Frontend -->|API Calls| Backend
    Backend -->|Queries| Data
    Backend -->|Cloud| AWS
    Data -->|Results| Backend
    Backend -->|Response| Frontend
    Frontend -->|Display| User
    
    style Frontend fill:#61dafb
    style Backend fill:#10b981
    style Data fill:#f59e0b
    style AWS fill:#e47911`;
    }

    const artifact: PitchArtifact = {
      id: `diagram_${Date.now()}`,
      type: 'architecture-diagram',
      title: 'Architecture Diagram',
      content: mermaidCode,
      metadata: {
        format: 'mermaid',
      },
      createdAt: Date.now(),
    };

    return artifact;
  }

  /**
   * Generate slide deck
   */
  private async generateSlideDeck(
    purpose: any,
    context: AgentContext
  ): Promise<PitchArtifact> {
    const { name, description } = context.repoMetadata;
    const modeConfig = getModeConfig(context.mode);
    const demoResult = context.previousResults?.demo;
    const demoUrl = demoResult?.artifacts?.[0]?.metadata?.url;

    const slides: PitchSlide[] = [];

    // Phase 2: Strict 6-slide structure: Title, Problem, Solution, Architecture, Demo, Impact

    // Slide 1: Title
    slides.push({
      title: name,
      content: `${description || purpose.description}\n\n**Built with:** ${purpose.techStack.join(', ')}`,
      layout: 'title',
    });

    // Slide 2: Problem
    slides.push({
      title: 'The Problem',
      content: context.mode === 'hackathon'
        ? `Developers face challenges in:\n- Creating professional documentation quickly\n- Deploying demos under time pressure\n- Preparing pitch materials for presentations\n\n**${name}** addresses these gaps with AI-powered automation.`
        : context.mode === 'placement'
        ? `Key challenges addressed:\n- ${purpose.keyHighlights.map((h: string) => h).join('\n- ')}\n\nThis project demonstrates ability to identify and solve real problems.`
        : `Code quality challenges identified:\n- Technical debt accumulation\n- Inconsistent documentation\n- Missing test coverage\n\n**Goal:** Systematic improvement of code quality.`,
      layout: 'content',
    });

    // Slide 3: Solution
    slides.push({
      title: 'The Solution',
      content: `**${name}** provides:\n\n${purpose.features.slice(0, 5).map((f: string) => `- ${f}`).join('\n')}\n\n**Tech Stack:** ${purpose.techStack.join(' | ')}`,
      layout: 'content',
    });

    // Slide 4: Architecture
    slides.push({
      title: 'Architecture',
      content: `System architecture with AWS cloud services:\n- ${purpose.techStack.join('\n- ')}\n- AWS Bedrock for AI\n- AWS DynamoDB for state\n- AWS S3 for artifacts`,
      layout: 'image',
    });

    // Slide 5: Demo
    slides.push({
      title: 'Demo',
      content: demoUrl
        ? `Live demo available at:\n\n**${demoUrl}**\n\nKey workflows demonstrated:\n- Repository analysis\n- Documentation generation\n- Deployment automation`
        : `Key workflows:\n\n1. Submit repository URL\n2. AI analyzes code and generates materials\n3. Review and approve changes\n4. Export artifacts and create PR`,
      layout: 'content',
    });

    // Slide 6: Impact
    slides.push({
      title: 'Impact',
      content: context.mode === 'hackathon'
        ? `**Results:**\n- Complete launch package in under 5 minutes\n- Professional documentation generated automatically\n- AWS-powered deployment and AI analysis\n\n**Thank you!** Questions?`
        : context.mode === 'placement'
        ? `**What I learned:**\n- Building production-ready applications\n- ${purpose.techStack.join(', ')} expertise\n- Clean code and testing practices\n\n**Thank you!** Looking forward to contributing to your team.`
        : `**Improvements achieved:**\n- Better code structure and organization\n- Enhanced documentation coverage\n- Reduced technical debt\n\n**Thank you!** Ready to improve and scale.`,
      layout: 'title',
    });

    // Convert slides to markdown
    const content = slides.map((slide, index) => {
      return `## Slide ${index + 1}: ${slide.title}\n\n${slide.content}\n\n---\n`;
    }).join('\n');

    const artifact: PitchArtifact = {
      id: `pitch_deck_${Date.now()}`,
      type: 'pitch-deck',
      title: 'Pitch Deck',
      content,
      metadata: {
        format: 'markdown',
        slides,
      },
      createdAt: Date.now(),
    };

    return artifact;
  }

  /**
   * Generate pitch script
   */
  private async generatePitchScript(
    purpose: any,
    context: AgentContext
  ): Promise<PitchArtifact> {
    const { name } = context.repoMetadata;
    const modeConfig = getModeConfig(context.mode);

    let script = '';

    // Introduction
    script += `# Pitch Script for ${name}\n\n`;
    script += `## Introduction (30 seconds)\n\n`;
    
    if (context.mode === 'hackathon') {
      script += `"Hi everyone! I'm excited to present ${name}, an innovative solution that ${purpose.description.toLowerCase()}. `;
      script += `We built this during the hackathon to address a real problem we've all experienced."\n\n`;
    } else if (context.mode === 'placement') {
      script += `"Good morning/afternoon. I'd like to present ${name}, a project that demonstrates my technical skills and problem-solving approach. `;
      script += `${purpose.description}"\n\n`;
    } else {
      script += `"Hello. I'm presenting ${name}, which showcases significant improvements in code quality and architecture. `;
      script += `${purpose.description}"\n\n`;
    }

    // Problem/Context
    script += `## Problem & Solution (45 seconds)\n\n`;
    script += `"The challenge we're addressing is [describe problem]. `;
    script += `Our solution leverages ${purpose.techStack.join(', ')} to provide a ${modeConfig.llmPromptModifiers.emphasis} approach."\n\n`;

    // Features
    script += `## Key Features (60 seconds)\n\n`;
    script += `"Let me highlight the key features:\n\n`;
    purpose.features.slice(0, 3).forEach((feature: string, index: number) => {
      script += `${index + 1}. ${feature}\n`;
    });
    script += `\nEach of these features was carefully designed with ${modeConfig.llmPromptModifiers.tone} in mind."\n\n`;

    // Technical Implementation
    script += `## Technical Implementation (45 seconds)\n\n`;
    script += `"From a technical perspective, we used:\n`;
    purpose.techStack.forEach((tech: string) => {
      script += `- ${tech}\n`;
    });
    script += `\nThis stack was chosen for its ${modeConfig.llmPromptModifiers.focus.join(', ')}."\n\n`;

    // Demo
    script += `## Demo (60 seconds)\n\n`;
    const demoResult = context.previousResults?.demo;
    const demoUrl = demoResult?.artifacts?.[0]?.metadata?.url;
    
    if (demoUrl) {
      script += `"Now, let me show you the live demo. [Navigate to ${demoUrl}]\n`;
      script += `As you can see, the application is fully functional and deployed. `;
      script += `[Demonstrate 2-3 key features]\n`;
      script += `The user experience is smooth and intuitive."\n\n`;
    } else {
      script += `"While we don't have a live demo today, I can walk you through the codebase and architecture. `;
      script += `[Show architecture diagram and explain key components]"\n\n`;
    }

    // Conclusion
    script += `## Conclusion (30 seconds)\n\n`;
    
    if (context.mode === 'hackathon') {
      script += `"In summary, ${name} demonstrates innovation, technical execution, and real-world applicability. `;
      script += `We're excited about the potential impact and would love to continue developing this. `;
      script += `Thank you, and I'm happy to answer any questions!"\n\n`;
    } else if (context.mode === 'placement') {
      script += `"This project showcases my ability to build production-ready applications with clean code and best practices. `;
      script += `I'm passionate about ${modeConfig.llmPromptModifiers.focus[0]} and would love to bring these skills to your team. `;
      script += `Thank you for your time!"\n\n`;
    } else {
      script += `"The refactoring demonstrates significant improvements in code quality, maintainability, and performance. `;
      script += `These changes position the project for future growth and scalability. `;
      script += `Thank you!"\n\n`;
    }

    // Q&A Tips
    script += `## Q&A Preparation\n\n`;
    script += `**Potential Questions:**\n`;
    script += `- "What was the biggest challenge?" → [Discuss technical or design challenge]\n`;
    script += `- "How does it scale?" → [Explain architecture decisions]\n`;
    script += `- "What's next?" → [Mention future features or improvements]\n`;

    const artifact: PitchArtifact = {
      id: `pitch_script_${Date.now()}`,
      type: 'pitch-script',
      title: 'Pitch Script',
      content: script,
      metadata: {
        format: 'text',
      },
      createdAt: Date.now(),
    };

    return artifact;
  }
}
