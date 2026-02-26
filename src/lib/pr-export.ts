/**
 * PR Link Export Utility
 * Formats and copies PR URL to clipboard
 */

import { Artifact } from '@/types';

/**
 * Extract PR URL from artifacts
 */
export function extractPRUrl(artifacts: Artifact[]): string | null {
  const prArtifact = artifacts.find((a) => a.type === 'pull-request');

  if (!prArtifact || !prArtifact.metadata?.prUrl) {
    return null;
  }

  return prArtifact.metadata.prUrl;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      return fallbackCopyToClipboard(text);
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Fallback clipboard copy for older browsers
 */
function fallbackCopyToClipboard(text: string): boolean {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (error) {
    console.error('Fallback copy failed:', error);
    document.body.removeChild(textArea);
    return false;
  }
}

/**
 * Format PR link for sharing
 */
export function formatPRLink(prUrl: string, repoName?: string): string {
  if (repoName) {
    return `Check out my pull request for ${repoName}: ${prUrl}`;
  }
  return prUrl;
}

/**
 * Generate shareable PR message
 */
export function generateShareableMessage(artifacts: Artifact[]): string | null {
  const prArtifact = artifacts.find((a) => a.type === 'pull-request');

  if (!prArtifact || !prArtifact.metadata?.prUrl) {
    return null;
  }

  const { prUrl, prNumber, title } = prArtifact.metadata;

  let message = `🚀 RepoClaw Generated Pull Request\n\n`;
  message += `PR #${prNumber}: ${title}\n`;
  message += `${prUrl}\n\n`;

  // Add demo link if available
  const demoArtifact = artifacts.find((a) => a.type === 'demo-url');
  if (demoArtifact && demoArtifact.metadata?.url) {
    message += `🔗 Live Demo: ${demoArtifact.metadata.url}\n\n`;
  }

  message += `Generated with RepoClaw - Transform your GitHub repository into production-ready deliverables`;

  return message;
}

/**
 * Validate PR artifact exists
 */
export function validatePRArtifact(artifacts: Artifact[]): {
  valid: boolean;
  message: string;
} {
  const prArtifact = artifacts.find((a) => a.type === 'pull-request');

  if (!prArtifact) {
    return {
      valid: false,
      message: 'No pull request found. Please complete the pipeline first.',
    };
  }

  if (!prArtifact.metadata?.prUrl) {
    return {
      valid: false,
      message: 'Pull request URL not available.',
    };
  }

  return {
    valid: true,
    message: 'Pull request ready to share',
  };
}

/**
 * Open PR in new tab
 */
export function openPRInNewTab(prUrl: string): void {
  window.open(prUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Generate QR code URL for PR (using external service)
 */
export function generatePRQRCodeUrl(prUrl: string): string {
  // Using a free QR code API service
  const encodedUrl = encodeURIComponent(prUrl);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedUrl}`;
}

/**
 * Export PR details as JSON
 */
export function exportPRAsJSON(artifacts: Artifact[]): string | null {
  const prArtifact = artifacts.find((a) => a.type === 'pull-request');

  if (!prArtifact) {
    return null;
  }

  const prData = {
    prNumber: prArtifact.metadata?.prNumber,
    prUrl: prArtifact.metadata?.prUrl,
    title: prArtifact.metadata?.title,
    body: prArtifact.metadata?.body,
    branch: prArtifact.metadata?.branch,
    checklist: prArtifact.metadata?.checklist,
    createdAt: prArtifact.createdAt,
  };

  return JSON.stringify(prData, null, 2);
}
