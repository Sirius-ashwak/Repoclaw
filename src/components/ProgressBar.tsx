/**
 * Progress Bar Component
 * Animated progress indicator for running agents
 */

'use client';

interface ProgressBarProps {
  progress?: number; // 0-100, undefined for indeterminate
  color?: 'blue' | 'green' | 'yellow' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({ 
  progress, 
  color = 'blue', 
  size = 'md' 
}: ProgressBarProps) {
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    red: 'bg-red-600',
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const bgColorClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    yellow: 'bg-yellow-100',
    red: 'bg-red-100',
  };

  return (
    <div className={`w-full ${bgColorClasses[color]} rounded-full overflow-hidden ${sizeClasses[size]}`}>
      {progress !== undefined ? (
        // Determinate progress
        <div
          className={`${colorClasses[color]} ${sizeClasses[size]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      ) : (
        // Indeterminate progress
        <div className="relative w-full h-full">
          <div
            className={`absolute inset-0 ${colorClasses[color]} animate-progress-bar`}
            style={{ width: '30%' }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Progress bar with label
 */
export function LabeledProgressBar({
  label,
  progress,
  color = 'blue',
}: {
  label: string;
  progress?: number;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        {progress !== undefined && (
          <span className="text-gray-500">{Math.round(progress)}%</span>
        )}
      </div>
      <ProgressBar progress={progress} color={color} />
    </div>
  );
}
