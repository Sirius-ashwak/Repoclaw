/**
 * Tests for ExportConfirmation component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportConfirmation, ExportResult, formatExportMessage } from '../ExportConfirmation';

describe('ExportConfirmation', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders success message for PDF export', () => {
    const result: ExportResult = {
      type: 'pdf',
      success: true,
      message: 'PDF exported successfully',
      downloadUrl: 'https://example.com/export.pdf',
    };

    render(<ExportConfirmation result={result} onClose={mockOnClose} />);

    expect(screen.getByText('Export Successful')).toBeInTheDocument();
    expect(screen.getByText('PDF exported successfully')).toBeInTheDocument();
    expect(screen.getByText('Download File')).toBeInTheDocument();
  });

  it('renders success message for PR export', () => {
    const result: ExportResult = {
      type: 'pr',
      success: true,
      message: 'Pull request link copied to clipboard',
      prUrl: 'https://github.com/owner/repo/pull/123',
    };

    render(<ExportConfirmation result={result} onClose={mockOnClose} />);

    expect(screen.getByText('Export Successful')).toBeInTheDocument();
    expect(screen.getByText('View Pull Request')).toBeInTheDocument();
  });

  it('renders success message for Telegram export', () => {
    const result: ExportResult = {
      type: 'telegram',
      success: true,
      message: 'Sent to Telegram successfully',
    };

    render(<ExportConfirmation result={result} onClose={mockOnClose} />);

    expect(screen.getByText('Export Successful')).toBeInTheDocument();
    expect(screen.getByText('Sent to Telegram successfully')).toBeInTheDocument();
  });

  it('renders error message for failed export', () => {
    const result: ExportResult = {
      type: 'pdf',
      success: false,
      message: 'Failed to generate PDF',
    };

    render(<ExportConfirmation result={result} onClose={mockOnClose} />);

    expect(screen.getByText('Export Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to generate PDF')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const result: ExportResult = {
      type: 'pdf',
      success: true,
      message: 'PDF exported successfully',
    };

    render(<ExportConfirmation result={result} onClose={mockOnClose} />);

    const closeButtons = screen.getAllByRole('button');
    fireEvent.click(closeButtons[0]);

    jest.advanceTimersByTime(300);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('auto-closes after 5 seconds on success', () => {
    const result: ExportResult = {
      type: 'pdf',
      success: true,
      message: 'PDF exported successfully',
    };

    render(<ExportConfirmation result={result} onClose={mockOnClose} />);

    expect(screen.getByText('Export Successful')).toBeInTheDocument();

    jest.advanceTimersByTime(5300);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not auto-close on failure', () => {
    const result: ExportResult = {
      type: 'pdf',
      success: false,
      message: 'Failed to generate PDF',
    };

    render(<ExportConfirmation result={result} onClose={mockOnClose} />);

    jest.advanceTimersByTime(10000);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('renders download link with correct href', () => {
    const result: ExportResult = {
      type: 'pdf',
      success: true,
      message: 'PDF exported successfully',
      downloadUrl: 'https://example.com/export.pdf',
    };

    render(<ExportConfirmation result={result} onClose={mockOnClose} />);

    const downloadLink = screen.getByText('Download File').closest('a');
    expect(downloadLink).toHaveAttribute('href', 'https://example.com/export.pdf');
    expect(downloadLink).toHaveAttribute('download');
  });

  it('renders PR link with correct href and target', () => {
    const result: ExportResult = {
      type: 'pr',
      success: true,
      message: 'Pull request link copied',
      prUrl: 'https://github.com/owner/repo/pull/123',
    };

    render(<ExportConfirmation result={result} onClose={mockOnClose} />);

    const prLink = screen.getByText('View Pull Request').closest('a');
    expect(prLink).toHaveAttribute('href', 'https://github.com/owner/repo/pull/123');
    expect(prLink).toHaveAttribute('target', '_blank');
    expect(prLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('formatExportMessage', () => {
  it('formats PDF export message', () => {
    expect(formatExportMessage('pdf')).toBe('PDF exported successfully');
  });

  it('formats PR export message', () => {
    expect(formatExportMessage('pr')).toBe('Pull Request Link exported successfully');
  });

  it('formats Telegram export message', () => {
    expect(formatExportMessage('telegram')).toBe('Telegram exported successfully');
  });
});
