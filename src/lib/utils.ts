/**
 * Utility functions for RepoClaw
 * Includes class name merging, validation helpers, and common utilities
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { GitHubRepoInfo } from "@/types";

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a timestamp to a human-readable date string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Check if a value is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if a string is a valid GitHub repository URL
 * Valid format: https://github.com/owner/repo
 * 
 * @param url - The URL string to validate
 * @returns true if the URL is a valid GitHub repository URL, false otherwise
 * 
 * @example
 * validateGitHubUrl('https://github.com/facebook/react') // true
 * validateGitHubUrl('https://github.com/owner/repo/') // true (trailing slash allowed)
 * validateGitHubUrl('http://github.com/owner/repo') // false (must be https)
 * validateGitHubUrl('https://github.com/owner') // false (missing repo)
 * validateGitHubUrl('https://gitlab.com/owner/repo') // false (not github.com)
 */
export function validateGitHubUrl(url: string): boolean {
  // GitHub URL pattern: https://github.com/owner/repo
  // Owner and repo can contain alphanumeric characters, hyphens, underscores, and dots
  // But cannot start with a hyphen or dot
  const githubUrlPattern = /^https:\/\/github\.com\/([a-zA-Z0-9][\w.-]*[a-zA-Z0-9])\/([a-zA-Z0-9][\w.-]*[a-zA-Z0-9])\/?$/;
  
  return githubUrlPattern.test(url);
}

/**
 * Extract owner and repository name from a GitHub URL
 * 
 * @param url - A valid GitHub repository URL
 * @returns An object containing owner, repo, and the original URL, or null if invalid
 * 
 * @example
 * extractGitHubRepoInfo('https://github.com/facebook/react')
 * // Returns: { owner: 'facebook', repo: 'react', url: 'https://github.com/facebook/react' }
 * 
 * extractGitHubRepoInfo('https://github.com/owner/repo/')
 * // Returns: { owner: 'owner', repo: 'repo', url: 'https://github.com/owner/repo/' }
 * 
 * extractGitHubRepoInfo('invalid-url')
 * // Returns: null
 */
export function extractGitHubRepoInfo(url: string): GitHubRepoInfo | null {
  if (!validateGitHubUrl(url)) {
    return null;
  }
  
  // Extract owner and repo using regex
  const match = url.match(/^https:\/\/github\.com\/([a-zA-Z0-9][\w.-]*[a-zA-Z0-9])\/([a-zA-Z0-9][\w.-]*[a-zA-Z0-9])\/?$/);
  
  if (!match) {
    return null;
  }
  
  const [, owner, repo] = match;
  
  return {
    owner,
    repo,
    url
  };
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
