'use client';

/**
 * TimeoutNotification Component
 * Displays warnings when pipeline or agents exceed time limits
 */

import { AgentType } from '@/types';
import { TIME_LIMITS, formatDuration } from '@/lib/performance';

interface TimeoutNotificationProps {
  type: 'pipeline' | 'agent';
  agent?: AgentType;
  elapsedTime: number;
  onDismiss?: () => void;
}

export default function TimeoutNotification({
  type,
  agent,
  elapsedTime,
  onDismiss,
}: TimeoutNotificationProps) {
  const getNotificationContent = () => {
    if (type === 'pipeline') {
      const limit = TIME_LIMITS.pipeline;
      const overtime = elapsedTime - limit;

      return {
        icon: '⏰',
        title: 'Pipeline Timeout Warning',
        message: `The pipeline has exceeded the 3-minute time limit by ${formatDuration(overtime)}.`,
        severity: 'high' as const,
      };
    } else if (type === 'agent' && agent) {
      const limit = TIME_LIMITS[agent];
      const overtime = elapsedTime - limit;

      return {
        icon: '⚠️',
        title: `${agent.toUpperCase()} Agent Timeout`,
        message: `The ${agent} agent has exceeded its time limit of ${formatDuration(limit)} by ${formatDuration(overtime)}.`,
        severity: 'medium' as const,
      };
    }

    return null;
  };

  const content = getNotificationContent();

  if (!content) {
    return null;
  }

  const bgColor =
    content.severity === 'high'
      ? 'bg-red-50 border-red-400'
      : 'bg-yellow-50 border-yellow-400';
  const textColor =
    content.severity === 'high' ? 'text-red-800' : 'text-yellow-800';

  return (
    <div className={`p-4 rounded-lg border-2 ${bgColor} ${textColor} mb-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">{content.icon}</span>
          <div>
            <h3 className="font-semibold mb-1">{content.title}</h3>
            <p className="text-sm">{content.message}</p>
            <p className="text-xs mt-2 opacity-75">
              This may indicate performance issues or complex processing requirements.
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-700 ml-4"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * TimeoutWarningBanner Component
 * Shows a banner when approaching time limits
 */
interface TimeoutWarningBannerProps {
  agent: AgentType;
  elapsedTime: number;
  warningThreshold?: number; // Percentage of time limit (default 80%)
}

export function TimeoutWarningBanner({
  agent,
  elapsedTime,
  warningThreshold = 0.8,
}: TimeoutWarningBannerProps) {
  const limit = TIME_LIMITS[agent];
  const percentUsed = elapsedTime / limit;

  if (percentUsed < warningThreshold) {
    return null;
  }

  const remaining = Math.max(0, limit - elapsedTime);
  const isOverTime = elapsedTime > limit;

  return (
    <div
      className={`p-3 rounded-lg ${
        isOverTime ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
      }`}
    >
      <div className="flex items-center space-x-2">
        <span>{isOverTime ? '⏰' : '⏱️'}</span>
        <span className="text-sm font-medium">
          {isOverTime
            ? `${agent.toUpperCase()} agent has exceeded time limit`
            : `${agent.toUpperCase()} agent approaching time limit: ${formatDuration(remaining)} remaining`}
        </span>
      </div>
    </div>
  );
}

/**
 * PipelineTimeoutAlert Component
 * Critical alert for pipeline timeout
 */
interface PipelineTimeoutAlertProps {
  elapsedTime: number;
  onRetry?: () => void;
  onCancel?: () => void;
}

export function PipelineTimeoutAlert({
  elapsedTime,
  onRetry,
  onCancel,
}: PipelineTimeoutAlertProps) {
  const overtime = elapsedTime - TIME_LIMITS.pipeline;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md shadow-xl">
        <div className="text-center mb-4">
          <span className="text-6xl">⏰</span>
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">Pipeline Timeout</h2>
        <p className="text-gray-700 text-center mb-4">
          The pipeline has exceeded the 3-minute time limit by{' '}
          <span className="font-semibold">{formatDuration(overtime)}</span>.
        </p>
        <p className="text-sm text-gray-600 text-center mb-6">
          This may be due to complex processing, network issues, or API rate limits.
        </p>
        <div className="flex space-x-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
            >
              Cancel
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Continue Waiting
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
