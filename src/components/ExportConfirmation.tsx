/**
 * Export Confirmation Component
 * Displays success message and download links after export
 */

'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Download, ExternalLink, X } from 'lucide-react';

export interface ExportResult {
  type: 'pdf' | 'pr' | 'telegram';
  success: boolean;
  message: string;
  downloadUrl?: string;
  prUrl?: string;
}

interface ExportConfirmationProps {
  result: ExportResult;
  onClose: () => void;
}

export function ExportConfirmation({ result, onClose }: ExportConfirmationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (result.success) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [result.success, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div
        className={`rounded-lg shadow-lg p-4 min-w-[320px] max-w-md ${
          result.success
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {result.success ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <X className="w-6 h-6 text-red-600" />
            )}
          </div>

          <div className="flex-1">
            <h3
              className={`font-semibold mb-1 ${
                result.success ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {result.success ? 'Export Successful' : 'Export Failed'}
            </h3>
            <p
              className={`text-sm ${
                result.success ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {result.message}
            </p>

            {result.success && (
              <div className="mt-3 flex flex-col gap-2">
                {result.downloadUrl && (
                  <a
                    href={result.downloadUrl}
                    download
                    className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-medium"
                  >
                    <Download className="w-4 h-4" />
                    Download File
                  </a>
                )}

                {result.prUrl && (
                  <a
                    href={result.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Pull Request
                  </a>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Export type labels
 */
export const EXPORT_TYPE_LABELS: Record<ExportResult['type'], string> = {
  pdf: 'PDF',
  pr: 'Pull Request Link',
  telegram: 'Telegram',
};

/**
 * Format export success message
 */
export function formatExportMessage(type: ExportResult['type']): string {
  const label = EXPORT_TYPE_LABELS[type];
  return `${label} exported successfully`;
}
