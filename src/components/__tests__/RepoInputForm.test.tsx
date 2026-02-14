/**
 * Unit tests for RepoInputForm component
 */

import { describe, test, expect, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RepoInputForm from '../RepoInputForm';

// Mock the github validation module
jest.mock('@/lib/github', () => ({
  validateAndParseGitHubUrl: jest.fn((url: string) => {
    if (url.startsWith('https://github.com/') && url.split('/').length === 5) {
      return { valid: true, owner: 'owner', repo: 'repo' };
    }
    return { valid: false, error: 'Invalid GitHub repository URL' };
  }),
}));

describe('RepoInputForm', () => {
  test('renders form with input and submit button', () => {
    const mockOnSubmit = jest.fn();
    render(<RepoInputForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/GitHub Repository URL/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/https:\/\/github.com\/owner\/repo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Repository/i })).toBeInTheDocument();
  });

  test('submit button is disabled when input is empty', () => {
    const mockOnSubmit = jest.fn();
    render(<RepoInputForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', { name: /Connect Repository/i });
    expect(submitButton).toBeDisabled();
  });

  test('displays error for invalid URL', async () => {
    const mockOnSubmit = jest.fn();
    render(<RepoInputForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/https:\/\/github.com\/owner\/repo/i);
    const submitButton = screen.getByRole('button', { name: /Connect Repository/i });

    fireEvent.change(input, { target: { value: 'invalid-url' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Invalid GitHub repository URL/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  test('calls onSubmit with valid URL', async () => {
    const mockOnSubmit = jest.fn();
    render(<RepoInputForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/https:\/\/github.com\/owner\/repo/i);
    const submitButton = screen.getByRole('button', { name: /Connect Repository/i });

    const validUrl = 'https://github.com/owner/repo';
    fireEvent.change(input, { target: { value: validUrl } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(validUrl);
    });
  });

  test('clears error when input changes', async () => {
    const mockOnSubmit = jest.fn();
    render(<RepoInputForm onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/https:\/\/github.com\/owner\/repo/i);
    const submitButton = screen.getByRole('button', { name: /Connect Repository/i });

    // Enter invalid URL
    fireEvent.change(input, { target: { value: 'invalid-url' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Invalid GitHub repository URL/i)).toBeInTheDocument();
    });

    // Change input
    fireEvent.change(input, { target: { value: 'https://github.com/owner/repo' } });

    // Error should be cleared
    expect(screen.queryByText(/Invalid GitHub repository URL/i)).not.toBeInTheDocument();
  });

  test('disables form when disabled prop is true', () => {
    const mockOnSubmit = jest.fn();
    render(<RepoInputForm onSubmit={mockOnSubmit} disabled={true} />);

    const input = screen.getByPlaceholderText(/https:\/\/github.com\/owner\/repo/i);
    const submitButton = screen.getByRole('button', { name: /Connect Repository/i });

    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });
});
