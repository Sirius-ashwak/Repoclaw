/**
 * POST /api/pipeline/start
 * Initializes SupervisorAgent with selected mode and creates pipeline state
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, createPipelineState, generateId } from '@/lib/kv';
import type { StartPipelineRequest, StartPipelineResponse } from '@/types';
import { isValidMode } from '@/lib/mode-config';

export async function POST(request: NextRequest) {
  try {
    const body: StartPipelineRequest = await request.json();
    const { sessionId, mode } = body;

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

    // Get session from KV
    const session = await getSession(sessionId);

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
    const pipelineId = generateId('pipe_');

    // Create pipeline state in KV
    await createPipelineState({
      id: pipelineId,
      sessionId,
      mode,
      status: 'initializing',
      currentAgent: null,
      agentResults: {
        analyze: null,
        docs: null,
        demo: null,
        pitch: null,
        supervisor: null,
      },
      approvalGates: [],
      artifacts: [],
      error: null,
      startedAt: Date.now(),
      completedAt: null,
      timestamps: {
        initialized: Date.now(),
      },
    });

    // Update session with pipeline ID
    await createSession({
      ...session,
      selectedMode: mode,
      pipelineId,
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
