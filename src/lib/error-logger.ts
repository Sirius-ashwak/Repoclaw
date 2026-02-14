/**
 * Error Logging Utility
 * Logs errors with agent name, message, timestamp and stores in Vercel KV
 */

import { kv } from '@vercel/kv';
import { AgentType } from '@/types';

export interface ErrorLog {
  id: string;
  pipelineId: string;
  agent: AgentType | null;
  message: string;
  details: string;
  timestamp: number;
  recoverable: boolean;
  stack?: string;
}

const ERROR_LOG_PREFIX = 'error:';
const ERROR_LOG_TTL = 60 * 60 * 24 * 7; // 7 days

/**
 * Log an error to Vercel KV
 */
export async function logError(error: Omit<ErrorLog, 'id' | 'timestamp'>): Promise<string> {
  const errorLog: ErrorLog = {
    ...error,
    id: generateErrorId(),
    timestamp: Date.now(),
  };

  const key = `${ERROR_LOG_PREFIX}${errorLog.id}`;
  await kv.set(key, errorLog, { ex: ERROR_LOG_TTL });

  // Also log to console for immediate visibility
  console.error(`[Error Log] ${errorLog.agent || 'System'}: ${errorLog.message}`, {
    details: errorLog.details,
    pipelineId: errorLog.pipelineId,
    recoverable: errorLog.recoverable,
  });

  return errorLog.id;
}

/**
 * Get error log by ID
 */
export async function getErrorLog(errorId: string): Promise<ErrorLog | null> {
  const key = `${ERROR_LOG_PREFIX}${errorId}`;
  return await kv.get<ErrorLog>(key);
}

/**
 * Get all error logs for a pipeline
 */
export async function getPipelineErrors(pipelineId: string): Promise<ErrorLog[]> {
  // Note: This is a simplified implementation
  // In production, you might want to use a secondary index or scan pattern
  const pattern = `${ERROR_LOG_PREFIX}*`;
  const keys = await kv.keys(pattern);
  
  const errors: ErrorLog[] = [];
  for (const key of keys) {
    const error = await kv.get<ErrorLog>(key);
    if (error && error.pipelineId === pipelineId) {
      errors.push(error);
    }
  }

  return errors.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Log agent error
 */
export async function logAgentError(
  pipelineId: string,
  agent: AgentType,
  error: Error,
  recoverable: boolean = true
): Promise<string> {
  return logError({
    pipelineId,
    agent,
    message: error.message,
    details: error.stack || error.toString(),
    recoverable,
    stack: error.stack,
  });
}

/**
 * Log system error (not agent-specific)
 */
export async function logSystemError(
  pipelineId: string,
  message: string,
  details: string,
  recoverable: boolean = false
): Promise<string> {
  return logError({
    pipelineId,
    agent: null,
    message,
    details,
    recoverable,
  });
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `err_${timestamp}-${randomStr}`;
}

/**
 * Format error for display
 */
export function formatErrorForDisplay(error: ErrorLog): string {
  const agentName = error.agent ? error.agent.toUpperCase() : 'SYSTEM';
  const date = new Date(error.timestamp).toLocaleString();
  const recoverable = error.recoverable ? 'Recoverable' : 'Fatal';
  
  return `[${date}] ${agentName} - ${recoverable}
Message: ${error.message}
Details: ${error.details}`;
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: Error): boolean {
  // Network errors are usually recoverable
  if (error.message.includes('network') || error.message.includes('timeout')) {
    return true;
  }

  // Rate limit errors are recoverable
  if (error.message.includes('rate limit')) {
    return true;
  }

  // Authentication errors might be recoverable
  if (error.message.includes('auth') || error.message.includes('token')) {
    return true;
  }

  // Default to non-recoverable for safety
  return false;
}

/**
 * Clean up old error logs
 */
export async function cleanupOldErrors(olderThanDays: number = 7): Promise<number> {
  const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const pattern = `${ERROR_LOG_PREFIX}*`;
  const keys = await kv.keys(pattern);
  
  let deletedCount = 0;
  for (const key of keys) {
    const error = await kv.get<ErrorLog>(key);
    if (error && error.timestamp < cutoffTime) {
      await kv.del(key);
      deletedCount++;
    }
  }

  return deletedCount;
}
