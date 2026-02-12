/**
 * Vercel KV configuration and utility functions
 * Provides type-safe access to session and pipeline state storage
 */

import { kv } from '@vercel/kv';
import type { Session, PipelineState, ApprovalGate } from '@/types';

// TTL constants (in seconds)
export const SESSION_TTL = 60 * 60; // 1 hour
export const PIPELINE_TTL = 60 * 60 * 24; // 24 hours
export const APPROVAL_GATE_TTL = 60 * 60; // 1 hour

// Key prefixes for different data types
const SESSION_PREFIX = 'session:';
const PIPELINE_PREFIX = 'pipeline:';
const APPROVAL_GATE_PREFIX = 'approval:';

// ============================================================================
// Session Management
// ============================================================================

export async function createSession(session: Session): Promise<void> {
  const key = `${SESSION_PREFIX}${session.id}`;
  await kv.set(key, session, { ex: SESSION_TTL });
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const key = `${SESSION_PREFIX}${sessionId}`;
  return await kv.get<Session>(key);
}

export async function updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  const updatedSession = { ...session, ...updates };
  await createSession(updatedSession);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const key = `${SESSION_PREFIX}${sessionId}`;
  await kv.del(key);
}

// ============================================================================
// Pipeline State Management
// ============================================================================

export async function createPipeline(pipeline: PipelineState): Promise<void> {
  const key = `${PIPELINE_PREFIX}${pipeline.id}`;
  await kv.set(key, pipeline, { ex: PIPELINE_TTL });
}

export async function getPipeline(pipelineId: string): Promise<PipelineState | null> {
  const key = `${PIPELINE_PREFIX}${pipelineId}`;
  return await kv.get<PipelineState>(key);
}

export async function updatePipeline(pipelineId: string, updates: Partial<PipelineState>): Promise<void> {
  const pipeline = await getPipeline(pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline ${pipelineId} not found`);
  }
  
  const updatedPipeline = { ...pipeline, ...updates };
  await createPipeline(updatedPipeline);
}

export async function deletePipeline(pipelineId: string): Promise<void> {
  const key = `${PIPELINE_PREFIX}${pipelineId}`;
  await kv.del(key);
}

// ============================================================================
// Approval Gate Management
// ============================================================================

export async function createApprovalGate(gate: ApprovalGate): Promise<void> {
  const key = `${APPROVAL_GATE_PREFIX}${gate.id}`;
  await kv.set(key, gate, { ex: APPROVAL_GATE_TTL });
}

export async function getApprovalGate(gateId: string): Promise<ApprovalGate | null> {
  const key = `${APPROVAL_GATE_PREFIX}${gateId}`;
  return await kv.get<ApprovalGate>(key);
}

export async function updateApprovalGate(gateId: string, updates: Partial<ApprovalGate>): Promise<void> {
  const gate = await getApprovalGate(gateId);
  if (!gate) {
    throw new Error(`Approval gate ${gateId} not found`);
  }
  
  const updatedGate = { ...gate, ...updates };
  await createApprovalGate(updatedGate);
}

export async function deleteApprovalGate(gateId: string): Promise<void> {
  const key = `${APPROVAL_GATE_PREFIX}${gateId}`;
  await kv.del(key);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${prefix}${timestamp}-${randomStr}`;
}

export async function cleanupExpiredData(): Promise<void> {
  // This would be called by a cron job or scheduled task
  // Vercel KV automatically handles TTL expiration, so this is mainly for manual cleanup if needed
  console.log('Cleanup task executed');
}
