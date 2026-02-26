/**
 * Tests for Session Manager
 */

import {
  saveSession,
  loadSession,
  clearSession,
  isSessionValid,
  extendSession,
  createSession,
  updateSession,
  getSessionExpirationWarning,
} from '../session-manager';
import { Session } from '@/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Session Manager', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('createSession', () => {
    it('creates a new session with correct properties', () => {
      const session = createSession('test-id', 'https://github.com/owner/repo', 'token-123');

      expect(session.id).toBe('test-id');
      expect(session.repoUrl).toBe('https://github.com/owner/repo');
      expect(session.githubToken).toBe('token-123');
      expect(session.repoMetadata).toBeNull();
      expect(session.selectedMode).toBeNull();
      expect(session.pipelineId).toBeNull();
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    it('saves session to localStorage', () => {
      const session = createSession('test-id', 'https://github.com/owner/repo', 'token-123');
      const loaded = loadSession();

      expect(loaded).toEqual(session);
    });
  });

  describe('saveSession and loadSession', () => {
    it('saves and loads session correctly', () => {
      const session: Session = {
        id: 'test-id',
        repoUrl: 'https://github.com/owner/repo',
        repoMetadata: null,
        githubToken: 'token-123',
        selectedMode: 'hackathon',
        pipelineId: 'pipeline-123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      saveSession(session);
      const loaded = loadSession();

      expect(loaded).toEqual(session);
    });

    it('returns null when no session exists', () => {
      const loaded = loadSession();
      expect(loaded).toBeNull();
    });

    it('returns null when session is expired', () => {
      const session: Session = {
        id: 'test-id',
        repoUrl: 'https://github.com/owner/repo',
        repoMetadata: null,
        githubToken: 'token-123',
        selectedMode: null,
        pipelineId: null,
        createdAt: Date.now() - 48 * 60 * 60 * 1000,
        expiresAt: Date.now() - 24 * 60 * 60 * 1000, // Expired
      };

      saveSession(session);
      const loaded = loadSession();

      expect(loaded).toBeNull();
    });
  });

  describe('clearSession', () => {
    it('removes session from localStorage', () => {
      const session = createSession('test-id', 'https://github.com/owner/repo', 'token-123');
      expect(loadSession()).toEqual(session);

      clearSession();
      expect(loadSession()).toBeNull();
    });
  });

  describe('isSessionValid', () => {
    it('returns true for valid session', () => {
      const session: Session = {
        id: 'test-id',
        repoUrl: 'https://github.com/owner/repo',
        repoMetadata: null,
        githubToken: 'token-123',
        selectedMode: null,
        pipelineId: null,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };

      expect(isSessionValid(session)).toBe(true);
    });

    it('returns false for expired session', () => {
      const session: Session = {
        id: 'test-id',
        repoUrl: 'https://github.com/owner/repo',
        repoMetadata: null,
        githubToken: 'token-123',
        selectedMode: null,
        pipelineId: null,
        createdAt: Date.now() - 48 * 60 * 60 * 1000,
        expiresAt: Date.now() - 1000, // Expired
      };

      expect(isSessionValid(session)).toBe(false);
    });

    it('returns false for null session', () => {
      expect(isSessionValid(null)).toBe(false);
    });
  });

  describe('extendSession', () => {
    it('extends session expiration time', () => {
      const session = createSession('test-id', 'https://github.com/owner/repo', 'token-123');
      const originalExpiry = session.expiresAt;

      // Wait a bit
      jest.advanceTimersByTime(1000);

      const extended = extendSession(session);

      expect(extended.expiresAt).toBeGreaterThan(originalExpiry);
      expect(extended.id).toBe(session.id);
    });
  });

  describe('updateSession', () => {
    it('updates session with new data', () => {
      const session = createSession('test-id', 'https://github.com/owner/repo', 'token-123');

      const updated = updateSession({
        selectedMode: 'placement',
        pipelineId: 'pipeline-456',
      });

      expect(updated).not.toBeNull();
      expect(updated?.selectedMode).toBe('placement');
      expect(updated?.pipelineId).toBe('pipeline-456');
      expect(updated?.id).toBe('test-id');
    });

    it('returns null when no session exists', () => {
      const updated = updateSession({ selectedMode: 'hackathon' });
      expect(updated).toBeNull();
    });
  });

  describe('getSessionExpirationWarning', () => {
    it('returns warning when less than 1 hour remaining', () => {
      const session: Session = {
        id: 'test-id',
        repoUrl: 'https://github.com/owner/repo',
        repoMetadata: null,
        githubToken: 'token-123',
        selectedMode: null,
        pipelineId: null,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
      };

      const warning = getSessionExpirationWarning(session);
      expect(warning).toContain('less than 1 hour');
    });

    it('returns warning when less than 2 hours remaining', () => {
      const session: Session = {
        id: 'test-id',
        repoUrl: 'https://github.com/owner/repo',
        repoMetadata: null,
        githubToken: 'token-123',
        selectedMode: null,
        pipelineId: null,
        createdAt: Date.now(),
        expiresAt: Date.now() + 90 * 60 * 1000, // 90 minutes
      };

      const warning = getSessionExpirationWarning(session);
      expect(warning).toContain('less than 2 hours');
    });

    it('returns null when plenty of time remaining', () => {
      const session: Session = {
        id: 'test-id',
        repoUrl: 'https://github.com/owner/repo',
        repoMetadata: null,
        githubToken: 'token-123',
        selectedMode: null,
        pipelineId: null,
        createdAt: Date.now(),
        expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
      };

      const warning = getSessionExpirationWarning(session);
      expect(warning).toBeNull();
    });
  });
});
