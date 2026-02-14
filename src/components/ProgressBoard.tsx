'use client';

/**
 * ProgressBoard Component
 * Visual pipeline status showing agent progress indicators
 */

import { AgentType, AgentStatus, Artifact, ApprovalGate, PipelineStatus } from '@/types';

interface ProgressBoardProps {
  pipelineStatus: PipelineStatus;
  currentAgent: AgentType | null;
  agentStatuses: Record<AgentType, AgentStatus>;
  artifacts: Artifact[];
  approvalGates: ApprovalGate[];
}

const AGENT_INFO: Record<AgentType, { name: string; icon: string; description: string }> = {
  analyze: {
    name: 'Analyze',
    icon: '🔍',
    description: 'Analyzing repository structure and stack',
  },
  docs: {
    name: 'Documentation',
    icon: '📝',
    description: 'Generating comprehensive documentation',
  },
  demo: {
    name: 'Demo',
    icon: '🚀',
    description: 'Deploying live demo to Vercel',
  },
  pitch: {
    name: 'Pitch',
    icon: '🎯',
    description: 'Creating pitch materials and diagrams',
  },
  supervisor: {
    name: 'Supervisor',
    icon: '👔',
    description: 'Orchestrating agents and creating PR',
  },
};

const AGENT_ORDER: AgentType[] = ['analyze', 'docs', 'demo', 'pitch', 'supervisor'];

export default function ProgressBoard({
  pipelineStatus,
  currentAgent,
  agentStatuses,
  artifacts,
  approvalGates,
}: ProgressBoardProps) {
  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'running':
        return 'bg-blue-500 animate-pulse';
      case 'failed':
        return 'bg-red-500';
      case 'skipped':
        return 'bg-gray-400';
      default:
        return 'bg-gray-300';
    }
  };

  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'running':
        return '⟳';
      case 'failed':
        return '✗';
      case 'skipped':
        return '−';
      default:
        return '○';
    }
  };

  const pendingApproval = approvalGates.find((gate) => gate.status === 'pending');

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Pipeline Progress</h2>
        <p className="text-gray-600">
          Status: <span className="font-medium">{pipelineStatus}</span>
        </p>
      </div>

      {/* Agent Pipeline */}
      <div className="space-y-4">
        {AGENT_ORDER.map((agentType, index) => {
          const info = AGENT_INFO[agentType];
          const status = agentStatuses[agentType] || 'pending';
          const isActive = currentAgent === agentType;
          const agentArtifacts = artifacts.filter(
            (a) =>
              (agentType === 'analyze' && a.type === 'analysis') ||
              (agentType === 'docs' && (a.type === 'readme' || a.type === 'api-docs')) ||
              (agentType === 'demo' && a.type === 'demo-url') ||
              (agentType === 'pitch' && (a.type === 'architecture-diagram' || a.type === 'pitch-deck' || a.type === 'pitch-script')) ||
              (agentType === 'supervisor' && a.type === 'pull-request')
          );

          return (
            <div
              key={agentType}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                ${status === 'completed' ? 'bg-green-50' : ''}
                ${status === 'failed' ? 'bg-red-50' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Status Indicator */}
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      text-white font-bold ${getStatusColor(status)}
                    `}
                  >
                    {getStatusIcon(status)}
                  </div>

                  {/* Agent Info */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{info.icon}</span>
                      <h3 className="text-lg font-semibold">{info.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600">{info.description}</p>
                  </div>
                </div>

                {/* Artifact Count */}
                {agentArtifacts.length > 0 && (
                  <div className="text-sm text-gray-500">
                    {agentArtifacts.length} artifact{agentArtifacts.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Artifact Previews */}
              {agentArtifacts.length > 0 && (
                <div className="mt-3 pl-14 space-y-1">
                  {agentArtifacts.map((artifact) => (
                    <div key={artifact.id} className="text-sm text-gray-700">
                      • {artifact.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Approval Prompt */}
      {pendingApproval && (
        <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-2xl">⏸️</span>
            <h3 className="text-lg font-semibold">Approval Required</h3>
          </div>
          <p className="text-sm text-gray-700">
            Please review the {pendingApproval.type} changes before proceeding.
          </p>
        </div>
      )}

      {/* Pipeline Status Messages */}
      {pipelineStatus === 'completed' && (
        <div className="mt-6 p-4 bg-green-50 border-2 border-green-400 rounded-lg text-center">
          <span className="text-2xl">🎉</span>
          <p className="text-lg font-semibold text-green-800">Pipeline Completed!</p>
        </div>
      )}

      {pipelineStatus === 'failed' && (
        <div className="mt-6 p-4 bg-red-50 border-2 border-red-400 rounded-lg text-center">
          <span className="text-2xl">❌</span>
          <p className="text-lg font-semibold text-red-800">Pipeline Failed</p>
        </div>
      )}
    </div>
  );
}
