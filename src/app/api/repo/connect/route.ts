/**
 * POST /api/repo/connect
 * Handles repository URL submission and initiates OAuth flow
 * Phase 2: Uses DynamoDB for session storage with 24-hour TTL
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAndParseGitHubUrl } from '@/lib/github';
import { DynamoDBSessionManager } from '@/lib/aws/dynamodb';
import type { ConnectRepoRequest, ConnectRepoResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: ConnectRepoRequest = await request.json();
    const { repoUrl } = body;

    // Validate the GitHub URL
    const validation = validateAndParseGitHubUrl(repoUrl);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid repository URL' },
        { status: 400 }
      );
    }

    // Generate session ID
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Create session in DynamoDB with 24-hour TTL
    const dynamodb = new DynamoDBSessionManager();
    await dynamodb.createSession({
      id: sessionId,
      repoUrl,
      repoMetadata: null,
      githubToken: '',
      selectedMode: null,
      pipelineId: null,
      language: 'en',
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    // Build OAuth URL
    const githubClientId = process.env.GITHUB_CLIENT_ID;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;

    if (!githubClientId || !callbackUrl) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=repo&state=${sessionId}`;

    const response: ConnectRepoResponse = {
      sessionId,
      requiresAuth: true,
      authUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/repo/connect:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
