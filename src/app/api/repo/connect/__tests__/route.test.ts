/**
 * Tests for /api/repo/connect endpoint
 * Property 2: OAuth Trigger for Valid URLs
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import * as fc from 'fast-check';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as kvModule from '@/lib/kv';

// Mock the KV module
jest.mock('@/lib/kv');

describe('POST /api/repo/connect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.GITHUB_CLIENT_ID = 'test_client_id';
    process.env.GITHUB_CALLBACK_URL = 'http://localhost:3000/api/auth/callback';
    
    // Mock KV functions
    (kvModule.createSession as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    (kvModule.generateId as jest.Mock) = jest.fn().mockReturnValue('sess_test123');
  });

  // ============================================================================
  // Unit Tests
  // ============================================================================

  describe('Unit Tests', () => {
    test('returns 400 for invalid GitHub URL', async () => {
      const request = new NextRequest('http://localhost:3000/api/repo/connect', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: 'invalid-url' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    test('returns OAuth URL for valid GitHub URL', async () => {
      const request = new NextRequest('http://localhost:3000/api/repo/connect', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: 'https://github.com/owner/repo' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBeDefined();
      expect(data.requiresAuth).toBe(true);
      expect(data.authUrl).toContain('github.com/login/oauth/authorize');
      expect(data.authUrl).toContain('test_client_id');
    });

    test('creates session in KV store', async () => {
      const request = new NextRequest('http://localhost:3000/api/repo/connect', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: 'https://github.com/owner/repo' }),
      });

      await POST(request);

      expect(kvModule.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sess_test123',
          repoUrl: 'https://github.com/owner/repo',
          repoMetadata: null,
          githubToken: '',
        })
      );
    });

    test('returns 500 if OAuth not configured', async () => {
      delete process.env.GITHUB_CLIENT_ID;

      const request = new NextRequest('http://localhost:3000/api/repo/connect', {
        method: 'POST',
        body: JSON.stringify({ repoUrl: 'https://github.com/owner/repo' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('OAuth not configured');
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  // Feature: repoclaw, Property 2: OAuth Trigger for Valid URLs
  describe('Property 2: OAuth Trigger for Valid URLs', () => {
    test('valid GitHub URLs always trigger OAuth flow', async () => {
      // Generate valid GitHub URLs
      const validGitHubUrl = fc.tuple(
        fc.stringMatching(/^[\w-]{1,39}$/), // GitHub username constraints
        fc.stringMatching(/^[\w-]{1,100}$/)  // GitHub repo name constraints
      ).map(([owner, repo]) => `https://github.com/${owner}/${repo}`);

      await fc.assert(
        fc.asyncProperty(validGitHubUrl, async (repoUrl) => {
          const request = new NextRequest('http://localhost:3000/api/repo/connect', {
            method: 'POST',
            body: JSON.stringify({ repoUrl }),
          });

          const response = await POST(request);
          const data = await response.json();

          // Valid URLs should return 200 and OAuth URL
          return (
            response.status === 200 &&
            data.requiresAuth === true &&
            data.authUrl !== undefined &&
            data.authUrl.includes('github.com/login/oauth/authorize') &&
            data.sessionId !== undefined
          );
        }),
        { numRuns: 100 }
      );
    });

    test('OAuth URL always contains required parameters', async () => {
      const validGitHubUrl = fc.tuple(
        fc.stringMatching(/^[\w-]{1,39}$/),
        fc.stringMatching(/^[\w-]{1,100}$/)
      ).map(([owner, repo]) => `https://github.com/${owner}/${repo}`);

      await fc.assert(
        fc.asyncProperty(validGitHubUrl, async (repoUrl) => {
          const request = new NextRequest('http://localhost:3000/api/repo/connect', {
            method: 'POST',
            body: JSON.stringify({ repoUrl }),
          });

          const response = await POST(request);
          const data = await response.json();

          if (response.status === 200 && data.authUrl) {
            const url = new URL(data.authUrl);
            
            // OAuth URL must contain client_id, redirect_uri, scope, and state
            return (
              url.searchParams.has('client_id') &&
              url.searchParams.has('redirect_uri') &&
              url.searchParams.has('scope') &&
              url.searchParams.has('state') &&
              url.searchParams.get('scope') === 'repo'
            );
          }
          
          return true; // Skip if not successful
        }),
        { numRuns: 100 }
      );
    });

    test('session ID in OAuth state matches returned session ID', async () => {
      const validGitHubUrl = fc.tuple(
        fc.stringMatching(/^[\w-]{1,39}$/),
        fc.stringMatching(/^[\w-]{1,100}$/)
      ).map(([owner, repo]) => `https://github.com/${owner}/${repo}`);

      await fc.assert(
        fc.asyncProperty(validGitHubUrl, async (repoUrl) => {
          const request = new NextRequest('http://localhost:3000/api/repo/connect', {
            method: 'POST',
            body: JSON.stringify({ repoUrl }),
          });

          const response = await POST(request);
          const data = await response.json();

          if (response.status === 200 && data.authUrl && data.sessionId) {
            const url = new URL(data.authUrl);
            const stateParam = url.searchParams.get('state');
            
            // State parameter should match session ID
            return stateParam === data.sessionId;
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    test('invalid URLs never trigger OAuth flow', async () => {
      const invalidUrl = fc.oneof(
        fc.constant(''),
        fc.constant('not-a-url'),
        fc.constant('http://github.com/owner/repo'), // http instead of https
        fc.constant('https://gitlab.com/owner/repo'),
        fc.constant('https://github.com/owner'), // missing repo
        fc.webUrl().filter(url => !url.includes('github.com'))
      );

      await fc.assert(
        fc.asyncProperty(invalidUrl, async (repoUrl) => {
          const request = new NextRequest('http://localhost:3000/api/repo/connect', {
            method: 'POST',
            body: JSON.stringify({ repoUrl }),
          });

          const response = await POST(request);
          const data = await response.json();

          // Invalid URLs should return error, not OAuth URL
          return response.status !== 200 || data.authUrl === undefined;
        }),
        { numRuns: 100 }
      );
    });

    test('session is always created for valid URLs', async () => {
      const validGitHubUrl = fc.tuple(
        fc.stringMatching(/^[\w-]{1,39}$/),
        fc.stringMatching(/^[\w-]{1,100}$/)
      ).map(([owner, repo]) => `https://github.com/${owner}/${repo}`);

      await fc.assert(
        fc.asyncProperty(validGitHubUrl, async (repoUrl) => {
          jest.clearAllMocks();
          
          const request = new NextRequest('http://localhost:3000/api/repo/connect', {
            method: 'POST',
            body: JSON.stringify({ repoUrl }),
          });

          const response = await POST(request);

          if (response.status === 200) {
            // createSession should have been called
            return (kvModule.createSession as jest.Mock).mock.calls.length === 1;
          }
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
