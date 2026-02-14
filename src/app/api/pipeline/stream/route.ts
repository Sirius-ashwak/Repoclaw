/**
 * GET /api/pipeline/stream
 * Server-Sent Events endpoint for real-time pipeline updates
 */

import { NextRequest } from 'next/server';
import { getPipeline } from '@/lib/kv';
import type { SSEEvent } from '@/types';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pipelineId = searchParams.get('pipelineId');

  if (!pipelineId) {
    return new Response('Pipeline ID is required', { status: 400 });
  }

  // Verify pipeline exists
  const pipeline = await getPipeline(pipelineId);
  if (!pipeline) {
    return new Response('Pipeline not found', { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      const initialEvent: SSEEvent = {
        type: 'pipeline_started',
        data: {
          pipelineId: pipeline.id,
          mode: pipeline.mode,
          status: pipeline.status,
        },
        timestamp: Date.now(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialEvent)}\n\n`));

      // Poll for pipeline updates
      const pollInterval = setInterval(async () => {
        try {
          const currentPipeline = await getPipeline(pipelineId);
          
          if (!currentPipeline) {
            clearInterval(pollInterval);
            controller.close();
            return;
          }

          // Send status update
          const statusEvent: SSEEvent = {
            type: 'agent_progress',
            data: {
              pipelineId: currentPipeline.id,
              status: currentPipeline.status,
              currentAgent: currentPipeline.currentAgent,
              agentResults: currentPipeline.agentResults,
              artifacts: currentPipeline.artifacts,
              approvalGates: currentPipeline.approvalGates,
            },
            timestamp: Date.now(),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(statusEvent)}\n\n`));

          // Check if pipeline is complete or failed
          if (currentPipeline.status === 'completed' || currentPipeline.status === 'failed') {
            const finalEvent: SSEEvent = {
              type: currentPipeline.status === 'completed' ? 'pipeline_completed' : 'pipeline_failed',
              data: {
                pipelineId: currentPipeline.id,
                status: currentPipeline.status,
                artifacts: currentPipeline.artifacts,
                error: currentPipeline.error,
              },
              timestamp: Date.now(),
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`));
            
            clearInterval(pollInterval);
            controller.close();
          }
        } catch (error) {
          console.error('Error in SSE stream:', error);
          const errorEvent: SSEEvent = {
            type: 'error',
            data: {
              message: 'Error fetching pipeline updates',
            },
            timestamp: Date.now(),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        }
      }, 1000); // Poll every second

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
