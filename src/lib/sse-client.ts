/**
 * SSE Client for Pipeline Stream
 * Handles Server-Sent Events connection and reconnection
 */

import { SSEEvent } from '@/types';

export type SSEEventHandler = (event: SSEEvent) => void;
export type SSEErrorHandler = (error: Error) => void;

export class SSEClient {
  private eventSource: EventSource | null = null;
  private url: string;
  private handlers: Map<string, SSEEventHandler[]> = new Map();
  private errorHandlers: SSEErrorHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Connect to SSE stream
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      this.eventSource = new EventSource(this.url);

      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const sseEvent: SSEEvent = JSON.parse(event.data);
          this.handleEvent(sseEvent);
        } catch (error) {
          console.error('Error parsing SSE event:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.handleError(new Error('SSE connection error'));
        
        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
          
          setTimeout(() => {
            this.connect();
          }, this.reconnectDelay);
          
          // Exponential backoff
          this.reconnectDelay *= 2;
        } else {
          console.error('Max reconnection attempts reached');
          this.disconnect();
        }
      };
    } catch (error) {
      console.error('Error creating EventSource:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('SSE connection closed');
    }
  }

  /**
   * Register event handler for specific event type
   */
  on(eventType: string, handler: SSEEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Register error handler
   */
  onError(handler: SSEErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Remove event handler
   */
  off(eventType: string, handler: SSEEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Handle incoming SSE event
   */
  private handleEvent(event: SSEEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      });
    }

    // Also trigger wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in wildcard event handler:', error);
        }
      });
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (err) {
        console.error('Error in error handler:', err);
      }
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }
}

/**
 * Create SSE client for pipeline stream
 */
export function createPipelineSSEClient(pipelineId: string): SSEClient {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/api/pipeline/stream?pipelineId=${pipelineId}`;
  return new SSEClient(url);
}

/**
 * Simple helper to connect to SSE endpoint
 * Returns EventSource for direct usage
 */
export function connectSSE(url: string): EventSource {
  return new EventSource(url);
}
