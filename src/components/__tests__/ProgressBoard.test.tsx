/**
 * Unit tests for ProgressBoard component
 */

import { describe, test, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import ProgressBoard from '../ProgressBoard';
import { AgentType, AgentStatus, PipelineStatus } from '@/types';

describe('ProgressBoard', () => {
  const mockAgentStatuses: Record<AgentType, AgentStatus> = {
    analyze: 'completed',
    docs: 'running',
    demo: 'pending',
    pitch: 'pending',
    supervisor: 'pending',
  };

  test('renders pipeline status', () => {
    render(
      <ProgressBoard
        pipelineStatus="running"
        currentAgent="docs"
        agentStatuses={mockAgentStatuses}
        artifacts={[]}
        approvalGates={[]}
      />
    );

    expect(screen.getByText(/Pipeline Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });

  test('displays all agents in correct order', () => {
    render(
      <ProgressBoard
        pipelineStatus="running"
        currentAgent="docs"
        agentStatuses={mockAgentStatuses}
        artifacts={[]}
        approvalGates={[]}
      />
    );

    expect(screen.getByText(/Analyze/i)).toBeInTheDocument();
    expect(screen.getByText(/Documentation/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo/i)).toBeInTheDocument();
    expect(screen.getByText(/Pitch/i)).toBeInTheDocument();
    expect(screen.getByText(/Supervisor/i)).toBeInTheDocument();
  });

  test('highlights active agent', () => {
    const { container } = render(
      <ProgressBoard
        pipelineStatus="running"
        currentAgent="docs"
        agentStatuses={mockAgentStatuses}
        artifacts={[]}
        approvalGates={[]}
      />
    );

    // Active agent should have blue border
    const activeAgentElements = container.querySelectorAll('.border-blue-500');
    expect(activeAgentElements.length).toBeGreaterThan(0);
  });

  test('displays artifact count', () => {
    const mockArtifacts = [
      {
        id: '1',
        type: 'readme' as const,
        title: 'README.md',
        content: 'content',
        metadata: {},
        createdAt: Date.now(),
      },
      {
        id: '2',
        type: 'api-docs' as const,
        title: 'API Documentation',
        content: 'content',
        metadata: {},
        createdAt: Date.now(),
      },
    ];

    render(
      <ProgressBoard
        pipelineStatus="running"
        currentAgent="docs"
        agentStatuses={mockAgentStatuses}
        artifacts={mockArtifacts}
        approvalGates={[]}
      />
    );

    expect(screen.getByText(/2 artifacts/i)).toBeInTheDocument();
  });

  test('displays approval prompt when pending', () => {
    const mockApprovalGates = [
      {
        id: '1',
        pipelineId: 'pipe-1',
        type: 'docs' as const,
        status: 'pending' as const,
        artifacts: [],
        feedback: null,
        createdAt: Date.now(),
        respondedAt: null,
      },
    ];

    render(
      <ProgressBoard
        pipelineStatus="waiting_approval"
        currentAgent="docs"
        agentStatuses={mockAgentStatuses}
        artifacts={[]}
        approvalGates={mockApprovalGates}
      />
    );

    expect(screen.getByText(/Approval Required/i)).toBeInTheDocument();
  });

  test('displays completion message when pipeline completes', () => {
    render(
      <ProgressBoard
        pipelineStatus="completed"
        currentAgent={null}
        agentStatuses={{
          analyze: 'completed',
          docs: 'completed',
          demo: 'completed',
          pitch: 'completed',
          supervisor: 'completed',
        }}
        artifacts={[]}
        approvalGates={[]}
      />
    );

    expect(screen.getByText(/Pipeline Completed!/i)).toBeInTheDocument();
  });

  test('displays failure message when pipeline fails', () => {
    render(
      <ProgressBoard
        pipelineStatus="failed"
        currentAgent={null}
        agentStatuses={{
          analyze: 'completed',
          docs: 'failed',
          demo: 'pending',
          pitch: 'pending',
          supervisor: 'pending',
        }}
        artifacts={[]}
        approvalGates={[]}
      />
    );

    expect(screen.getByText(/Pipeline Failed/i)).toBeInTheDocument();
  });
});
