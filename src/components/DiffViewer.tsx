'use client';

/**
 * DiffViewer Component
 * Side-by-side diff display with approve/reject buttons
 */

import { useState } from 'react';
import { DiffContent } from '@/types';

interface DiffViewerProps {
  original: string;
  generated: string;
  diff: DiffContent;
  onApprove: (feedback?: string) => void;
  onReject: (feedback: string) => void;
  disabled?: boolean;
}

export default function DiffViewer({
  original,
  generated,
  diff,
  onApprove,
  onReject,
  disabled = false,
}: DiffViewerProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');

  const handleApprove = () => {
    onApprove(feedback || undefined);
  };

  const handleReject = () => {
    if (!feedback.trim()) {
      alert('Please provide feedback for rejection');
      return;
    }
    onReject(feedback);
  };

  const renderDiffLine = (line: any, index: number) => {
    const bgColor =
      line.type === 'add'
        ? 'bg-green-100'
        : line.type === 'delete'
        ? 'bg-red-100'
        : 'bg-white';
    const textColor =
      line.type === 'add'
        ? 'text-green-800'
        : line.type === 'delete'
        ? 'text-red-800'
        : 'text-gray-800';
    const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' ';

    return (
      <div key={index} className={`${bgColor} ${textColor} px-4 py-1 font-mono text-sm`}>
        <span className="inline-block w-8 text-gray-500">{prefix}</span>
        <span>{line.content}</span>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Review Changes</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('split')}
            className={`px-4 py-2 rounded ${
              viewMode === 'split' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Split View
          </button>
          <button
            onClick={() => setViewMode('unified')}
            className={`px-4 py-2 rounded ${
              viewMode === 'unified' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Unified View
          </button>
        </div>
      </div>

      {/* Diff Stats */}
      <div className="mb-4 p-3 bg-gray-100 rounded flex items-center space-x-4 text-sm">
        <span className="text-green-600">+{diff.additions} additions</span>
        <span className="text-red-600">-{diff.deletions} deletions</span>
      </div>

      {/* Diff Content */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Original */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-200 px-4 py-2 font-semibold">Original</div>
            <div className="max-h-96 overflow-y-auto">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap">{original}</pre>
            </div>
          </div>

          {/* Generated */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-200 px-4 py-2 font-semibold">Generated</div>
            <div className="max-h-96 overflow-y-auto">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap">{generated}</pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden mb-6">
          <div className="bg-gray-200 px-4 py-2 font-semibold">Unified Diff</div>
          <div className="max-h-96 overflow-y-auto">
            {diff.hunks.map((hunk, hunkIndex) => (
              <div key={hunkIndex}>
                <div className="bg-gray-300 px-4 py-1 text-xs font-mono">
                  @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </div>
                {hunk.lines.map((line, lineIndex) => renderDiffLine(line, lineIndex))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Section */}
      {showFeedback && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Feedback (optional for approval, required for rejection)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Provide feedback on the changes..."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            disabled={disabled}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFeedback(!showFeedback)}
          className="text-blue-600 hover:underline"
          disabled={disabled}
        >
          {showFeedback ? 'Hide' : 'Add'} Feedback
        </button>

        <div className="flex space-x-4">
          <button
            onClick={handleReject}
            disabled={disabled}
            className={`
              px-6 py-2 rounded-lg font-medium transition-colors
              ${
                disabled
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }
            `}
          >
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={disabled}
            className={`
              px-6 py-2 rounded-lg font-medium transition-colors
              ${
                disabled
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }
            `}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
