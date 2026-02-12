/**
 * GET /api/auth/callback
 * Handles GitHub OAuth callback and token exchange
 */

import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { getSession, updateSession } from '@/lib/kv';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is our session ID
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/?error=missing_parameters', request.url)
      );
    }

    // Verify session exists
    const session = await getSession(state);
    if (!session) {
      return NextResponse.redirect(
        new URL('/?error=invalid_session', request.url)
      );
    }

    // Exchange code for access token
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/?error=oauth_not_configured', request.url)
      );
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(tokenData.error || 'token_exchange_failed')}`, request.url)
      );
    }

    // Store token in session
    await updateSession(state, {
      githubToken: tokenData.access_token,
    });

    // Fetch repository metadata
    const octokit = new Octokit({ auth: tokenData.access_token });
    
    // Parse repo URL to get owner and repo
    const urlMatch = session.repoUrl.match(/github\.com\/([\w-]+)\/([\w-]+)/);
    if (!urlMatch) {
      return NextResponse.redirect(
        new URL('/?error=invalid_repo_url', request.url)
      );
    }

    const [, owner, repo] = urlMatch;

    try {
      const { data: repoData } = await octokit.repos.get({
        owner,
        repo,
      });

      // Update session with metadata
      await updateSession(state, {
        repoMetadata: {
          owner: repoData.owner.login,
          name: repoData.name,
          fullName: repoData.full_name,
          defaultBranch: repoData.default_branch,
          isPrivate: repoData.private,
          description: repoData.description,
          language: repoData.language,
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          url: repoData.html_url,
        },
      });

      // Redirect to app with session ID
      return NextResponse.redirect(
        new URL(`/?session=${state}`, request.url)
      );
    } catch (repoError: any) {
      console.error('Error fetching repository:', repoError);
      return NextResponse.redirect(
        new URL(`/?error=repo_not_found&details=${encodeURIComponent(repoError.message)}`, request.url)
      );
    }
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/?error=callback_failed', request.url)
    );
  }
}
