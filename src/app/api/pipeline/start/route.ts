/**
 * POST /api/pipeline/start
 * Initializes SupervisorAgent with selected mode and creates pipeline state
 * Phase 2: Uses DynamoDB for state, Bedrock for LLM, supports language selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBSessionManager } from '@/lib/aws/dynamodb';
import type { StartPipelineResponse } from '@/types';
import { isValidMode } from '@/lib/mode-config';

const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta', 'te', 'bn', 'mr'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, mode, language = 'en' } = body;

    // Validate session ID
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validate mode
    if (!mode || !isValidMode(mode)) {
      return NextResponse.json(
        { error: 'Valid mode is required (hackathon, placement, or refactor)' },
        { status: 400 }
      );
    }

    // Validate language
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json(
        { error: `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}` },
        { status: 400 }
      );
    }

    // Get session from DynamoDB
    const dynamodb = new DynamoDBSessionManager();
    const session = await dynamodb.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    // Verify session has required data
    if (!session.repoMetadata) {
      return NextResponse.json(
        { error: 'Repository metadata not found. Please authenticate first.' },
        { status: 400 }
      );
    }

    if (!session.githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not found. Please authenticate first.' },
        { status: 400 }
      );
    }

    // Generate pipeline ID
    const pipelineId = `pipe_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Create pipeline state in DynamoDB
    await dynamodb.createPipeline({
      id: pipelineId,
      sessionId,
      status: 'initializing',
      currentAgent: null,
      results: [],
      approvalGates: [],
      artifacts: [],
      startedAt: Date.now(),
      completedAt: null,
      error: null,
      metadata: {
        mode,
        repoUrl: session.repoUrl,
        totalExecutionTime: 0,
        bedrockCost: 0,
        s3StorageUsed: 0,
      },
    });

    // Update session with pipeline ID and language
    await dynamodb.updateSession(sessionId, {
      selectedMode: mode,
      pipelineId,
      language,
    });

    // Build SSE stream URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const streamUrl = `${baseUrl}/api/pipeline/stream?pipelineId=${pipelineId}`;

    const response: StartPipelineResponse = {
      pipelineId,
      streamUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/pipeline/start:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
