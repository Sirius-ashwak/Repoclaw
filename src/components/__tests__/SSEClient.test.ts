/**
 * Unit tests for SSE Client
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { SSEClient } from '../sse-client';
import { SSEEvent } from '@/types';

// Mock EventSource
class MockEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = 0;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockEventSource.CONNECTING;
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      if (this.onopen) this.onopen();
    }, 0);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  simulateMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

global.EventSource = MockEventSource as any;

describe('SSEClient', () => {
  let client: SSEClient;
  const testUrl = 'http://localhost:3000/api/pipeline/stream?pipelineId=test';

  beforeEach(() => {
    client = new SSEClient(testUrl);
  });

  test('creates client with URL', () => {
    expect(client).toBeDefined();
  });

  test('connects to SSE stream', () => {
    client.connect();
    expect(client.isConnected()).toBe(false); // Initially connecting
  });

  test('handles incoming events', (done) => {
    const mockEvent: SSEEvent = {
      type: 'pipeline_started',
      data: { pipelineId: 'test' },
      timestamp: Date.now(),
    };

    client.on('pipeline_started', (event) => {
      expect(event.type).toBe('pipeline_started');
      expect(event.data.pipelineId).toBe('test');
      done();
    });

    client.connect();

    // Simulate message after connection
    setTimeout(() => {
      const eventSource = (client as any).eventSource as MockEventSource;
      eventSource.simulateMessage(JSON.stringify(mockEvent));
    }, 10);
  });

  test('handles multiple event handlers', (done) => {
    let handler1Called = false;
    let handler2Called = false;

    const mockEvent: SSEEvent = {
      type: 'agent_started',
      data: { agent: 'analyze' },
      timestamp: Date.now(),
    };

    client.on('agent_started', () => {
      handler1Called = true;
    });

    client.on('agent_started', () => {
      handler2Called = true;
      expect(handler1Called).toBe(true);
      expect(handler2Called).toBe(true);
      done();
    });

    client.connect();

    setTimeout(() => {
      const eventSource = (client as any).eventSource as MockEventSource;
      eventSource.simulateMessage(JSON.stringify(mockEvent));
    }, 10);
  });

  test('handles errors', (done) => {
    client.onError((error) => {
      expect(error).toBeInstanceOf(Error);
      done();
    });

    client.connect();

    setTimeout(() => {
      const eventSource = (client as any).eventSource as MockEventSource;
      eventSource.simulateError();
    }, 10);
  });

  test('disconnects from stream', () => {
    client.connect();
    client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  test('removes event handlers', (done) => {
    let callCount = 0;

    const handler = () => {
      callCount++;
    };

    client.on('test_event', handler);
    client.off('test_event', handler);

    client.connect();

    setTimeout(() => {
      const mockEvent: SSEEvent = {
        type: 'test_event',
        data: {},
        timestamp: Date.now(),
      };

      const eventSource = (client as any).eventSource as MockEventSource;
      eventSource.simulateMessage(JSON.stringify(mockEvent));

      setTimeout(() => {
        expect(callCount).toBe(0);
        done();
      }, 10);
    }, 10);
  });
});
