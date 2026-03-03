'use client';

import { useState, useEffect } from 'react';

export type ConnectivityMode = 'online' | 'offline';

interface OfflineModeIndicatorProps {
  mode: ConnectivityMode;
  onRetryConnection?: () => void;
}

export function OfflineModeIndicator({ mode, onRetryConnection }: OfflineModeIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (mode === 'online') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full text-sm">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-700 dark:text-green-400 font-medium">Online</span>
        <span className="text-green-600 dark:text-green-500 text-xs">AWS Bedrock</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full text-sm cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        <span className="text-orange-700 dark:text-orange-400 font-medium">Offline</span>
        <span className="text-orange-600 dark:text-orange-500 text-xs">Ollama</span>
      </button>

      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4 z-20">
          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Offline Mode</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            You are currently offline. RepoClaw is using local Ollama for AI operations.
            Some features may be limited.
          </p>
          <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span> Basic code analysis
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">&#10003;</span> README generation (simplified)
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">&#10007;</span> AWS deployment config
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">&#10007;</span> Audio pitch generation
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">&#10007;</span> Translation services
            </div>
          </div>
          {onRetryConnection && (
            <button
              onClick={onRetryConnection}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Retry Connection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
