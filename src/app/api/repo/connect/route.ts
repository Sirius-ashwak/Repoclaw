/**
 * POST /api/repo/connect
 * Handles repository URL submission and initiates OAuth flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAndParseGitHubUrl } from '@/lib/github';
import { createSession, generateId } from '@/lib/kv';
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
    const sessionId = generateId('sess_');

    // Create session in KV
    await createSession({
      id: sessionId,
      repoUrl,
      repoMetadata: null,
      githubToken: '',
      selectedMode: null,
      pipelineId: null,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
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
