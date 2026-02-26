'use client';

/**
 * RepoInputForm Component
 * Input field for GitHub repository URL with validation
 */

import { useState } from 'react';
import { validateAndParseGitHubUrl } from '@/lib/github';

interface RepoInputFormProps {
  onSubmit: (repoUrl: string) => void;
  disabled?: boolean;
}

export default function RepoInputForm({ onSubmit, disabled = false }: RepoInputFormProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsValidating(true);

    // Validate URL
    const validation = validateAndParseGitHubUrl(repoUrl);

    if (!validation.valid) {
      setError(validation.error || 'Invalid GitHub repository URL');
      setIsValidating(false);
      return;
    }

    // Call onSubmit callback
    onSubmit(repoUrl);
    setIsValidating(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRepoUrl(e.target.value);
    setError(null); // Clear error on input change
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">RepoClaw</h1>
        <p className="text-gray-600">
          Transform your GitHub repository into production-ready deliverables
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="repoUrl" className="block text-sm font-medium mb-2">
            GitHub Repository URL
          </label>
          <input
            id="repoUrl"
            type="text"
            value={repoUrl}
            onChange={handleInputChange}
            placeholder="https://github.com/owner/repo"
            disabled={disabled || isValidating}
            className={`
              w-full px-4 py-3 rounded-lg border-2 transition-colors
              ${error ? 'border-red-500' : 'border-gray-300'}
              ${disabled || isValidating ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 flex items-center">
              <span className="mr-1">⚠️</span>
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={disabled || isValidating || !repoUrl}
          className={`
            w-full py-3 px-6 rounded-lg font-medium transition-all
            ${
              disabled || isValidating || !repoUrl
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }
          `}
        >
          {isValidating ? 'Validating...' : 'Connect Repository'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Example: https://github.com/vercel/next.js</p>
      </div>
    </div>
  );
}


// Named export for compatibility
export { RepoInputForm };
