/**
 * Session Management Utility
 * Handles session persistence, expiration, and cleanup
 */

import { Session } from '@/types';

const SESSION_STORAGE_KEY = 'repoclaw_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Save session to localStorage
 */
export function saveSession(session: Session): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

/**
 * Load session from localStorage
 */
export function loadSession(): Session | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const session: Session = JSON.parse(stored);

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
}

/**
 * Clear session from localStorage
 */
export function clearSession(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

/**
 * Check if session is valid
 */
export function isSessionValid(session: Session | null): boolean {
  if (!session) {
    return false;
  }

  return Date.now() < session.expiresAt;
}

/**
 * Extend session expiration
 */
export function extendSession(session: Session): Session {
  const extendedSession = {
    ...session,
    expiresAt: Date.now() + SESSION_DURATION,
  };

  saveSession(extendedSession);
  return extendedSession;
}

/**
 * Create new session
 */
export function createSession(
  id: string,
  repoUrl: string,
  githubToken: string
): Session {
  const session: Session = {
    id,
    repoUrl,
    repoMetadata: null,
    githubToken,
    selectedMode: null,
    pipelineId: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION,
  };

  saveSession(session);
  return session;
}

/**
 * Update session with new data
 */
export function updateSession(updates: Partial<Session>): Session | null {
  const session = loadSession();
  if (!session) {
    return null;
  }

  const updatedSession = {
    ...session,
    ...updates,
  };

  saveSession(updatedSession);
  return updatedSession;
}

/**
 * Get session ID from URL query params (for OAuth callback)
 */
export function getSessionIdFromURL(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('sessionId');
}

/**
 * Clean up expired sessions from Vercel KV
 * This should be called periodically by a cron job or background task
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const response = await fetch('/api/session/cleanup', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to cleanup sessions');
    }

    const data = await response.json();
    return data.cleaned || 0;
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Restore session state after page refresh
 */
export function restoreSessionState(): {
  sessionId: string | null;
  pipelineId: string | null;
  hasValidSession: boolean;
} {
  const session = loadSession();

  if (!session || !isSessionValid(session)) {
    return {
      sessionId: null,
      pipelineId: null,
      hasValidSession: false,
    };
  }

  return {
    sessionId: session.id,
    pipelineId: session.pipelineId,
    hasValidSession: true,
  };
}

/**
 * Handle session expiration warning
 */
export function getSessionExpirationWarning(session: Session): string | null {
  const timeRemaining = session.expiresAt - Date.now();
  const hoursRemaining = timeRemaining / (60 * 60 * 1000);

  if (hoursRemaining < 1) {
    return 'Your session will expire in less than 1 hour';
  }

  if (hoursRemaining < 2) {
    return 'Your session will expire in less than 2 hours';
  }

  return null;
}
