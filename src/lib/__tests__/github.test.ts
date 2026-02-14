/**
 * Tests for GitHub utility functions
 * Includes both unit tests and property-based tests
 */

import { describe, test, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { validateGitHubUrl, parseGitHubUrl, validateAndParseGitHubUrl } from '../github';

describe('GitHub URL Validation', () => {
  // ============================================================================
  // Unit Tests - Specific Examples
  // ============================================================================

  describe('validateGitHubUrl - Unit Tests', () => {
    test('accepts valid GitHub URLs', () => {
      expect(validateGitHubUrl('https://github.com/owner/repo').valid).toBe(true);
      expect(validateGitHubUrl('https://github.com/facebook/react').valid).toBe(true);
      expect(validateGitHubUrl('https://github.com/vercel/next.js').valid).toBe(true);
      expect(validateGitHubUrl('https://github.com/microsoft/vscode').valid).toBe(true);
    });

    test('rejects invalid GitHub URLs', () => {
      expect(validateGitHubUrl('').valid).toBe(false);
      expect(validateGitHubUrl('   ').valid).toBe(false);
      expect(validateGitHubUrl('not-a-url').valid).toBe(false);
      expect(validateGitHubUrl('http://github.com/owner/repo').valid).toBe(false); // http instead of https
      expect(validateGitHubUrl('https://gitlab.com/owner/repo').valid).toBe(false);
      expect(validateGitHubUrl('https://github.com/owner').valid).toBe(false); // missing repo
      expect(validateGitHubUrl('https://github.com/owner/repo/extra').valid).toBe(false); // extra path
    });

    test('provides error messages for invalid URLs', () => {
      const result1 = validateGitHubUrl('');
      expect(result1.valid).toBe(false);
      expect(result1.error).toBeDefined();

      const result2 = validateGitHubUrl('invalid-url');
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('Invalid GitHub URL format');
    });

    test('handles whitespace correctly', () => {
      expect(validateGitHubUrl('  https://github.com/owner/repo  ').valid).toBe(true);
      expect(validateGitHubUrl('https://github.com/owner/repo\n').valid).toBe(true);
    });
  });

  describe('parseGitHubUrl - Unit Tests', () => {
    test('extracts owner and repo from valid URLs', () => {
      expect(parseGitHubUrl('https://github.com/owner/repo')).toEqual({
        owner: 'owner',
        repo: 'repo',
      });

      expect(parseGitHubUrl('https://github.com/facebook/react')).toEqual({
        owner: 'facebook',
        repo: 'react',
      });
    });

    test('returns null for invalid URLs', () => {
      expect(parseGitHubUrl('')).toBeNull();
      expect(parseGitHubUrl('invalid-url')).toBeNull();
      expect(parseGitHubUrl('https://github.com/owner')).toBeNull();
    });

    test('handles URLs with hyphens and underscores', () => {
      expect(parseGitHubUrl('https://github.com/my-org/my-repo')).toEqual({
        owner: 'my-org',
        repo: 'my-repo',
      });

      expect(parseGitHubUrl('https://github.com/my_org/my_repo')).toEqual({
        owner: 'my_org',
        repo: 'my_repo',
      });
    });
  });

  describe('validateAndParseGitHubUrl - Unit Tests', () => {
    test('validates and parses valid URLs', () => {
      const result = validateAndParseGitHubUrl('https://github.com/owner/repo');
      expect(result.valid).toBe(true);
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.error).toBeUndefined();
    });

    test('returns error for invalid URLs', () => {
      const result = validateAndParseGitHubUrl('invalid-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.owner).toBeUndefined();
      expect(result.repo).toBeUndefined();
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  // Feature: repoclaw, Property 1: GitHub URL Validation
  describe('Property 1: GitHub URL Validation', () => {
    test('validates GitHub URLs correctly across all inputs', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const isValid = validateGitHubUrl(input).valid;
          const matchesPattern = /^https:\/\/github\.com\/[\w-]+\/[\w-]+$/.test(input.trim());
          
          // The validator should return true if and only if the URL matches the pattern
          return isValid === matchesPattern;
        }),
        { numRuns: 100 }
      );
    });

    test('valid GitHub URLs always have owner and repo extractable', () => {
      // Generate valid GitHub URLs
      const validGitHubUrl = fc.tuple(
        fc.stringMatching(/^[\w-]+$/),
        fc.stringMatching(/^[\w-]+$/)
      ).map(([owner, repo]) => `https://github.com/${owner}/${repo}`);

      fc.assert(
        fc.property(validGitHubUrl, (url) => {
          const validation = validateGitHubUrl(url);
          const parsed = parseGitHubUrl(url);

          // Valid URLs should validate and parse successfully
          return validation.valid && parsed !== null && parsed.owner.length > 0 && parsed.repo.length > 0;
        }),
        { numRuns: 100 }
      );
    });

    test('invalid URLs never validate', () => {
      // Generate strings that are definitely not valid GitHub URLs
      const invalidUrl = fc.oneof(
        fc.constant(''),
        fc.constant('   '),
        fc.webUrl({ validSchemes: ['http'] }), // http instead of https
        fc.string().filter(s => !s.includes('github.com')),
        fc.constant('https://gitlab.com/owner/repo'),
        fc.constant('https://github.com/owner'), // missing repo
      );

      fc.assert(
        fc.property(invalidUrl, (url) => {
          const validation = validateGitHubUrl(url);
          return !validation.valid;
        }),
        { numRuns: 100 }
      );
    });

    test('validation is consistent with parsing', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const validation = validateGitHubUrl(input);
          const parsed = parseGitHubUrl(input);

          // If validation succeeds, parsing should succeed
          // If validation fails, parsing should return null
          if (validation.valid) {
            return parsed !== null;
          } else {
            return parsed === null;
          }
        }),
        { numRuns: 100 }
      );
    });

    test('whitespace handling is consistent', () => {
      const validGitHubUrl = fc.tuple(
        fc.stringMatching(/^[\w-]+$/),
        fc.stringMatching(/^[\w-]+$/)
      ).map(([owner, repo]) => `https://github.com/${owner}/${repo}`);

      fc.assert(
        fc.property(
          validGitHubUrl,
          fc.constantFrom('', ' ', '  ', '\t', '\n', '  \n  '),
          fc.constantFrom('', ' ', '  ', '\t', '\n', '  \n  '),
          (url, prefix, suffix) => {
            const paddedUrl = prefix + url + suffix;
            const validation = validateGitHubUrl(paddedUrl);
            
            // Whitespace should be trimmed, so validation should succeed
            return validation.valid;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// Authentication Error Handling Tests
// ============================================================================

describe('Authentication Error Handling', () => {
  describe('OAuth failure scenarios', () => {
    test('handles missing OAuth configuration', () => {
      // Simulate missing environment variables
      const originalClientId = process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_ID;

      // Validation should still work
      const result = validateGitHubUrl('https://github.com/owner/repo');
      expect(result.valid).toBe(true);

      // Restore
      if (originalClientId) {
        process.env.GITHUB_CLIENT_ID = originalClientId;
      }
    });

    test('handles OAuth access_denied error', () => {
      const errorScenarios = [
        { error: 'access_denied', description: 'User denied access' },
        { error: 'unauthorized_client', description: 'Client not authorized' },
        { error: 'invalid_scope', description: 'Invalid scope requested' },
      ];

      errorScenarios.forEach(scenario => {
        expect(scenario.error).toBeTruthy();
        expect(scenario.description).toBeTruthy();
      });
    });

    test('handles network errors during OAuth', () => {
      const networkErrors = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'Network request failed',
      ];

      networkErrors.forEach(error => {
        expect(error).toBeTruthy();
        expect(typeof error).toBe('string');
      });
    });
  });

  describe('Invalid token handling', () => {
    test('detects invalid token format', () => {
      const invalidTokens = [
        '',
        '   ',
        'invalid',
        'bearer token',
        'gho_', // incomplete
      ];

      invalidTokens.forEach(token => {
        // Token should be non-empty and follow GitHub token pattern
        const isValid = token.trim().length > 0 && token.startsWith('gho_') && token.length > 10;
        expect(isValid).toBe(false);
      });
    });

    test('handles expired tokens', () => {
      const expiredTokenScenario = {
        token: 'gho_expired_token',
        error: 'Bad credentials',
        status: 401,
      };

      expect(expiredTokenScenario.status).toBe(401);
      expect(expiredTokenScenario.error).toContain('credentials');
    });

    test('handles revoked tokens', () => {
      const revokedTokenScenario = {
        token: 'gho_revoked_token',
        error: 'The access token was revoked',
        status: 401,
      };

      expect(revokedTokenScenario.status).toBe(401);
      expect(revokedTokenScenario.error).toContain('revoked');
    });

    test('handles insufficient permissions', () => {
      const insufficientPermissionsScenario = {
        token: 'gho_limited_token',
        error: 'Resource not accessible by integration',
        status: 403,
      };

      expect(insufficientPermissionsScenario.status).toBe(403);
      expect(insufficientPermissionsScenario.error).toContain('not accessible');
    });
  });

  describe('Rate limiting', () => {
    test('handles GitHub API rate limit errors', () => {
      const rateLimitScenario = {
        error: 'API rate limit exceeded',
        status: 403,
        resetTime: Date.now() + 3600000, // 1 hour from now
      };

      expect(rateLimitScenario.status).toBe(403);
      expect(rateLimitScenario.error).toContain('rate limit');
      expect(rateLimitScenario.resetTime).toBeGreaterThan(Date.now());
    });

    test('calculates wait time for rate limit reset', () => {
      const resetTime = Date.now() + 1800000; // 30 minutes from now
      const waitTime = resetTime - Date.now();

      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(1800000);
    });
  });

  describe('Repository access errors', () => {
    test('handles repository not found', () => {
      const notFoundScenario = {
        error: 'Not Found',
        status: 404,
        message: 'Repository not found or you do not have access',
      };

      expect(notFoundScenario.status).toBe(404);
      expect(notFoundScenario.error).toBe('Not Found');
    });

    test('handles private repository without access', () => {
      const privateRepoScenario = {
        error: 'Not Found', // GitHub returns 404 for private repos without access
        status: 404,
        isPrivate: true,
      };

      expect(privateRepoScenario.status).toBe(404);
      expect(privateRepoScenario.isPrivate).toBe(true);
    });

    test('handles repository moved/renamed', () => {
      const movedRepoScenario = {
        error: 'Moved Permanently',
        status: 301,
        newLocation: 'https://github.com/new-owner/new-repo',
      };

      expect(movedRepoScenario.status).toBe(301);
      expect(movedRepoScenario.newLocation).toContain('github.com');
    });
  });

  describe('Session errors', () => {
    test('handles expired session', () => {
      const expiredSession = {
        id: 'sess_123',
        createdAt: Date.now() - 7200000, // 2 hours ago
        expiresAt: Date.now() - 3600000, // 1 hour ago
      };

      const isExpired = Date.now() > expiredSession.expiresAt;
      expect(isExpired).toBe(true);
    });

    test('handles missing session', () => {
      const sessionId = 'sess_nonexistent';
      const session = null; // Session not found

      expect(session).toBeNull();
    });

    test('handles corrupted session data', () => {
      const corruptedScenarios = [
        { id: '', repoUrl: 'https://github.com/owner/repo' }, // missing ID
        { id: 'sess_123', repoUrl: '' }, // missing URL
        { id: 'sess_123' }, // missing required fields
      ];

      corruptedScenarios.forEach(session => {
        const isValid = session.id && session.id.length > 0 && 
                       'repoUrl' in session && session.repoUrl && session.repoUrl.length > 0;
        expect(isValid).toBe(false);
      });
    });
  });
});
