'use client';

/**
 * TimingDisplay Component
 * Displays elapsed time and performance metrics for pipeline
 */

import { useEffect, useState } from 'react';
import { formatDuration, TIME_LIMITS } from '@/lib/performance';
import { AgentType } from '@/types';

interface TimingDisplayProps {
  startTime: number;
  currentAgent: AgentType | null;
  agentTimings: Record<AgentType, { duration: number } | null>;
  isComplete: boolean;
}

export default function TimingDisplay({
  startTime,
  currentAgent,
  agentTimings,
  isComplete,
}: TimingDisplayProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (isComplete) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isComplete]);

  const totalElapsed = isComplete
    ? Object.values(agentTimings)
        .filter((t) => t !== null)
        .reduce((sum, t) => sum + t!.duration, 0)
    : elapsedTime;

  const isOverTime = totalElapsed > TIME_LIMITS.pipeline;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between">
        {/* Total Elapsed Time */}
        <div className="flex items-center space-x-2">
          <span className="text-2xl">⏱️</span>
          <div>
            <div className="text-sm text-gray-600">Total Time</div>
            <div
              className={`text-2xl font-bold ${
                isOverTime ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {formatDuration(totalElapsed)}
            </div>
          </div>
        </div>

        {/* Time Limit */}
        <div className="text-right">
          <div className="text-sm text-gray-600">Time Limit</div>
          <div className="text-lg font-medium text-gray-700">
            {formatDuration(TIME_LIMITS.pipeline)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isOverTime ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{
              width: `${Math.min(100, (totalElapsed / TIME_LIMITS.pipeline) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Agent Timings */}
      {Object.keys(agentTimings).some((k) => agentTimings[k as AgentType] !== null) && (
        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium text-gray-700">Agent Timings:</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(Object.keys(agentTimings) as AgentType[]).map((agent) => {
              const timing = agentTimings[agent];
              if (!timing) return null;

              const isAgentOverTime = timing.duration > TIME_LIMITS[agent];

              return (
                <div
                  key={agent}
                  className={`p-2 rounded text-center ${
                    isAgentOverTime ? 'bg-red-50' : 'bg-gray-50'
                  }`}
                >
                  <div className="text-xs text-gray-600 capitalize">{agent}</div>
                  <div
                    className={`text-sm font-medium ${
                      isAgentOverTime ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {formatDuration(timing.duration)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Warning Message */}
      {isOverTime && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-400 rounded">
          <p className="text-sm text-yellow-800">
            ⚠️ Pipeline is taking longer than expected. This may indicate performance issues.
          </p>
        </div>
      )}

      {/* Current Agent */}
      {currentAgent && !isComplete && (
        <div className="mt-4 text-sm text-gray-600">
          Currently running: <span className="font-medium capitalize">{currentAgent}</span>
        </div>
      )}
    </div>
  );
}


// Named export for compatibility
export { TimingDisplay };
