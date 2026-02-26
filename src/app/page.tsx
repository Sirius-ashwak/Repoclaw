'use client';

import { useState, useEffect } from 'react';
import { RepoInputForm } from '@/components/RepoInputForm';
import { ModeSelector } from '@/components/ModeSelector';
import { ProgressBoard } from '@/components/ProgressBoard';
import { DiffViewer } from '@/components/DiffViewer';
import { ArtifactCarousel } from '@/components/ArtifactCarousel';
import { ExportConfirmation, ExportResult } from '@/components/ExportConfirmation';
import { TimingDisplay } from '@/components/TimingDisplay';
import { TimeoutNotification } from '@/components/TimeoutNotification';
import { LoadingSpinner, LoadingOverlay } from '@/components/LoadingSpinner';
import { connectSSE } from '@/lib/sse-client';
import { 
  loadSession, 
  saveSession, 
  clearSession, 
  restoreSessionState,
  getSessionExpirationWarning 
} from '@/lib/session-manager';
import type { 
  Mode, 
  PipelineState, 
  ApprovalGate, 
  Artifact,
  SSEEvent,
  AgentType,
  Session 
} from '@/types';

type AppState = 'loading' | 'input' | 'mode-selection' | 'pipeline-running' | 'completed';

export default function Home() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [pipelineState, setPipelineState] = useState<Partial<PipelineState> | null>(null);
  const [pendingApproval, setPendingApproval] = useState<ApprovalGate | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    const restored = restoreSessionState();
    
    if (restored.hasValidSession && restored.sessionId) {
      setSessionId(restored.sessionId);
      
      if (restored.pipelineId) {
        setPipelineId(restored.pipelineId);
        setAppState('pipeline-running');
        connectToStream(restored.pipelineId);
      } else {
        setAppState('mode-selection');
      }

      // Check for session expiration warning
      const session = loadSession();
      if (session) {
        const warning = getSessionExpirationWarning(session);
        setSessionWarning(warning);
      }
    } else {
      setAppState('input');
    }
  }, []);

  // Check session expiration periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const session = loadSession();
      if (session) {
        const warning = getSessionExpirationWarning(session);
        setSessionWarning(warning);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  // Handle repository connection
  const handleRepoConnect = async (repoUrl: string) => {
    try {
      setError(null);
      const response = await fetch('/api/repo/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect repository');
      }

      if (data.requiresAuth && data.authUrl) {
        // Redirect to GitHub OAuth
        window.location.href = data.authUrl;
        return;
      }

      setSessionId(data.sessionId);
      setAppState('mode-selection');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect repository');
    }
  };

  // Handle mode selection
  const handleModeSelect = async (mode: Mode) => {
    if (!sessionId) return;

    try {
      setError(null);
      setSelectedMode(mode);

      const response = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, mode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start pipeline');
      }

      setPipelineId(data.pipelineId);
      setAppState('pipeline-running');

      // Connect to SSE stream
      connectToStream(data.pipelineId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start pipeline');
    }
  };

  // Connect to SSE stream
  const connectToStream = (pipelineId: string) => {
    const eventSource = connectSSE(`/api/pipeline/stream?pipelineId=${pipelineId}`);

    eventSource.onmessage = (event) => {
      try {
        const sseEvent: SSEEvent = JSON.parse(event.data);
        handleSSEEvent(sseEvent);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };
  };

  // Handle SSE events
  const handleSSEEvent = (event: SSEEvent) => {
    switch (event.type) {
      case 'pipeline_started':
        setPipelineState({
          status: 'running',
          currentAgent: event.data.currentAgent,
          startedAt: event.timestamp,
        });
        break;

      case 'agent_started':
        setPipelineState((prev) => ({
          ...prev,
          currentAgent: event.data.agent as AgentType,
        }));
        break;

      case 'agent_completed':
        setPipelineState((prev) => ({
          ...prev,
          agentResults: {
            ...prev?.agentResults,
            [event.data.agent]: event.data.result,
          },
        }));
        break;

      case 'artifact_generated':
        setPipelineState((prev) => ({
          ...prev,
          artifacts: [...(prev?.artifacts || []), event.data.artifact],
        }));
        break;

      case 'approval_required':
        setPendingApproval(event.data.gate);
        setPipelineState((prev) => ({
          ...prev,
          status: 'waiting_approval',
        }));
        break;

      case 'approval_responded':
        setPendingApproval(null);
        setPipelineState((prev) => ({
          ...prev,
          status: 'running',
        }));
        break;

      case 'pipeline_completed':
        setPipelineState((prev) => ({
          ...prev,
          status: 'completed',
          completedAt: event.timestamp,
        }));
        setAppState('completed');
        break;

      case 'pipeline_failed':
        setPipelineState((prev) => ({
          ...prev,
          status: 'failed',
          error: event.data.error,
        }));
        setError(event.data.error.message);
        break;

      case 'error':
        setError(event.data.message);
        break;
    }
  };

  // Handle approval response
  const handleApprovalResponse = async (approved: boolean, feedback?: string) => {
    if (!pendingApproval) return;

    try {
      const response = await fetch('/api/approval/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateId: pendingApproval.id,
          approved,
          feedback,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit approval response');
      }

      setPendingApproval(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit approval');
    }
  };

  // Handle export
  const handleExport = async (format: 'pdf' | 'pr-link' | 'telegram', chatId?: string) => {
    if (!pipelineId) return;

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId,
          format,
          options: chatId ? { telegramChatId: chatId } : undefined,
        }),
      });

      const result = await response.json();
      setExportResult(result);
    } catch (err) {
      setExportResult({
        type: format === 'pr-link' ? 'pr' : format,
        success: false,
        message: 'Export failed',
      });
    }
  };

  // Handle retry
  const handleRetry = () => {
    setError(null);
    if (appState === 'input') {
      // Reset to input state
      setSessionId(null);
      setPipelineId(null);
      setSelectedMode(null);
      setPipelineState(null);
    } else if (appState === 'mode-selection') {
      // Stay in mode selection
    } else {
      // Retry pipeline
      if (selectedMode) {
        handleModeSelect(selectedMode);
      }
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            RepoClaw
          </h1>
          <p className="text-lg text-muted-foreground">
            Transform your GitHub repository into production-ready deliverables
          </p>
        </header>

        {/* Session Warning */}
        {sessionWarning && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">{sessionWarning}</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          {appState === 'loading' && (
            <div className="flex items-center justify-center min-h-[400px]">
              <LoadingSpinner size="lg" message="Restoring session..." />
            </div>
          )}

          {appState === 'input' && (
            <div className="max-w-2xl mx-auto">
              <RepoInputForm onSubmit={handleRepoConnect} />
            </div>
          )}

          {appState === 'mode-selection' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-semibold text-center mb-8">
                Select Your Mode
              </h2>
              <ModeSelector onSelect={handleModeSelect} />
            </div>
          )}

          {(appState === 'pipeline-running' || appState === 'completed') && pipelineState && (
            <div className="space-y-8">
              {/* Timing Display */}
              {pipelineState.startedAt && (
                <TimingDisplay
                  startTime={pipelineState.startedAt}
                  endTime={pipelineState.completedAt || undefined}
                  agentTimings={pipelineState.agentResults || {}}
                />
              )}

              {/* Timeout Notification */}
              {pipelineState.status === 'running' && pipelineState.startedAt && (
                <TimeoutNotification
                  startTime={pipelineState.startedAt}
                  currentAgent={pipelineState.currentAgent || undefined}
                />
              )}

              {/* Progress Board */}
              <ProgressBoard
                currentAgent={pipelineState.currentAgent || undefined}
                agentResults={pipelineState.agentResults || {}}
                artifacts={pipelineState.artifacts || []}
                status={pipelineState.status || 'running'}
              />

              {/* Approval Gate */}
              {pendingApproval && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                  <h3 className="text-xl font-semibold mb-4">Approval Required</h3>
                  <DiffViewer
                    artifacts={pendingApproval.artifacts}
                    onApprove={(feedback) => handleApprovalResponse(true, feedback)}
                    onReject={(feedback) => handleApprovalResponse(false, feedback)}
                  />
                </div>
              )}

              {/* Artifact Carousel */}
              {appState === 'completed' && pipelineState.artifacts && pipelineState.artifacts.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
                  <h3 className="text-xl font-semibold mb-4">Generated Artifacts</h3>
                  <ArtifactCarousel
                    artifacts={pipelineState.artifacts}
                    onExport={handleExport}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Export Confirmation */}
        {exportResult && (
          <ExportConfirmation
            result={exportResult}
            onClose={() => setExportResult(null)}
          />
        )}
      </div>
    </main>
  );
}
