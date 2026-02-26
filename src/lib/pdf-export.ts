/**
 * PDF Export Utility
 * Bundles README, API docs, and pitch deck into a single PDF
 */

import { Artifact } from '@/types';

/**
 * Generate PDF from artifacts
 * Note: This is a placeholder implementation
 * In production, use a library like pdf-lib, jsPDF, or Puppeteer
 */
export async function generatePDF(artifacts: Artifact[]): Promise<Blob> {
  // Filter relevant artifacts for PDF
  const relevantArtifacts = artifacts.filter((a) =>
    ['readme', 'api-docs', 'pitch-deck', 'pitch-script', 'architecture-diagram'].includes(a.type)
  );

  // Create PDF content
  const pdfContent = createPDFContent(relevantArtifacts);

  // In production, use a proper PDF library
  // For now, return a text blob as placeholder
  const blob = new Blob([pdfContent], { type: 'application/pdf' });
  return blob;
}

/**
 * Create PDF content from artifacts
 */
function createPDFContent(artifacts: Artifact[]): string {
  let content = 'RepoClaw Export\n\n';
  content += `Generated: ${new Date().toLocaleString()}\n`;
  content += '='.repeat(80) + '\n\n';

  for (const artifact of artifacts) {
    content += `\n${artifact.title}\n`;
    content += '-'.repeat(artifact.title.length) + '\n\n';
    content += artifact.content + '\n\n';
    content += '='.repeat(80) + '\n';
  }

  return content;
}

/**
 * Download PDF file
 */
export function downloadPDF(blob: Blob, filename: string = 'repoclaw-export.pdf'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate PDF with proper formatting
 * This is a more advanced implementation using HTML to PDF conversion
 */
export async function generateFormattedPDF(artifacts: Artifact[]): Promise<Blob> {
  const html = generateHTMLForPDF(artifacts);

  // In production, use Puppeteer or similar to convert HTML to PDF
  // For now, return HTML as blob
  const blob = new Blob([html], { type: 'text/html' });
  return blob;
}

/**
 * Generate HTML content for PDF conversion
 */
function generateHTMLForPDF(artifacts: Artifact[]): string {
  const relevantArtifacts = artifacts.filter((a) =>
    ['readme', 'api-docs', 'pitch-deck', 'pitch-script', 'architecture-diagram'].includes(a.type)
  );

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>RepoClaw Export</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #4A90E2;
      padding-bottom: 10px;
    }
    h2 {
      color: #555;
      margin-top: 30px;
      border-bottom: 2px solid #ddd;
      padding-bottom: 5px;
    }
    pre {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    .artifact {
      page-break-after: always;
      margin-bottom: 40px;
    }
    .metadata {
      color: #888;
      font-size: 0.9em;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h1>RepoClaw Export</h1>
  <div class="metadata">
    <p>Generated: ${new Date().toLocaleString()}</p>
    <p>Artifacts: ${relevantArtifacts.length}</p>
  </div>
`;

  for (const artifact of relevantArtifacts) {
    html += `
  <div class="artifact">
    <h2>${artifact.title}</h2>
    <pre>${escapeHTML(artifact.content)}</pre>
  </div>
`;
  }

  html += `
</body>
</html>
`;

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get export filename with timestamp
 */
export function getExportFilename(prefix: string = 'repoclaw-export'): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${prefix}-${timestamp}.pdf`;
}

/**
 * Validate artifacts for PDF export
 */
export function validateArtifactsForPDF(artifacts: Artifact[]): {
  valid: boolean;
  message: string;
} {
  const relevantArtifacts = artifacts.filter((a) =>
    ['readme', 'api-docs', 'pitch-deck', 'pitch-script', 'architecture-diagram'].includes(a.type)
  );

  if (relevantArtifacts.length === 0) {
    return {
      valid: false,
      message: 'No exportable artifacts found. Please complete the pipeline first.',
    };
  }

  return {
    valid: true,
    message: `Ready to export ${relevantArtifacts.length} artifact(s)`,
  };
}
