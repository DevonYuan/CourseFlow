/**
 * EmptyState Tests
 *
 * Tests for the empty state component.
 */

// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EmptyState } from '../components/EmptyState';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend expect with jest-dom matchers
expect.extend(matchers);

describe('EmptyState', () => {
  const mockOnOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders default message and subtext', () => {
    render(<EmptyState onOpenSettings={mockOnOpenSettings} />);

    expect(screen.getByText('No assignments yet')).toBeInTheDocument();
    expect(screen.getByText('Add your Canvas iCal URL in Settings to get started')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
  });

  it('renders custom message, subtext, and CTA text', () => {
    render(
      <EmptyState
        onOpenSettings={mockOnOpenSettings}
        message="Custom message"
        subtext="Custom subtext"
        ctaText="Custom CTA"
      />
    );

    expect(screen.getByText('Custom message')).toBeInTheDocument();
    expect(screen.getByText('Custom subtext')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom CTA' })).toBeInTheDocument();
  });

  it('calls onOpenSettings when CTA button is clicked', () => {
    render(<EmptyState onOpenSettings={mockOnOpenSettings} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));

    expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('has proper ARIA attributes', () => {
    render(<EmptyState onOpenSettings={mockOnOpenSettings} />);

    const container = screen.getByRole('status');
    expect(container).toHaveAttribute('aria-live', 'polite');
  });

  it('renders illustration SVG', () => {
    render(<EmptyState onOpenSettings={mockOnOpenSettings} />);

    // SVG is inside aria-hidden div, so not accessible by role
    // Check for the illustration container instead
    const illustration = screen.getByTestId('empty-state-illustration');
    expect(illustration).toBeInTheDocument();
  });

  it('heading has proper structure', () => {
    render(<EmptyState onOpenSettings={mockOnOpenSettings} />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('No assignments yet');
  });
});