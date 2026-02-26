/**
 * POST /api/session/cleanup
 * Cleans up expired sessions from Vercel KV
 */

import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST() {
  try {
    let cleaned = 0;
    const now = Date.now();

    // Get all session keys
    const sessionKeys = await kv.keys('session:*');

    // Check each session and delete if expired
    for (const key of sessionKeys) {
      const session = await kv.get(key);
      
      if (session && typeof session === 'object' && 'expiresAt' in session) {
        const expiresAt = (session as any).expiresAt;
        
        if (typeof expiresAt === 'number' && now > expiresAt) {
          await kv.del(key);
          cleaned++;
        }
      }
    }

    // Also cleanup expired pipelines
    const pipelineKeys = await kv.keys('pipeline:*');
    
    for (const key of pipelineKeys) {
      const pipeline = await kv.get(key);
      
      if (pipeline && typeof pipeline === 'object' && 'startedAt' in pipeline) {
        const startedAt = (pipeline as any).startedAt;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (typeof startedAt === 'number' && now - startedAt > maxAge) {
          await kv.del(key);
          cleaned++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      cleaned,
      message: `Cleaned up ${cleaned} expired session(s)`,
    });
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup sessions' },
      { status: 500 }
    );
  }
}
