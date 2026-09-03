/**
 * AssignmentListSkeleton Tests
 *
 * Tests for the skeleton loader component.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AssignmentListSkeleton } from '../components/AssignmentListSkeleton';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend expect with jest-dom matchers
expect.extend(matchers);

describe('AssignmentListSkeleton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders default 4 skeleton rows', () => {
    render(<AssignmentListSkeleton />);
    const rows = screen.getAllByRole('status');
    expect(rows).toHaveLength(1); // One container with role="status"
    const skeletonRows = screen.getAllByTestId('skeleton-row');
    expect(skeletonRows).toHaveLength(4);
  });

  it('renders custom count of skeleton rows', () => {
    render(<AssignmentListSkeleton count={3} />);
    const skeletonRows = screen.getAllByTestId('skeleton-row');
    expect(skeletonRows).toHaveLength(3);
  });

  it('renders 5 skeleton rows when count is 5', () => {
    render(<AssignmentListSkeleton count={5} />);
    const skeletonRows = screen.getAllByTestId('skeleton-row');
    expect(skeletonRows).toHaveLength(5);
  });

  it('has proper ARIA attributes for loading state', () => {
    render(<AssignmentListSkeleton />);
    const container = screen.getByRole('status');
    expect(container).toHaveAttribute('aria-live', 'polite');
    expect(container).toHaveAttribute('aria-label', 'Loading assignments');
  });

  it('each row has course, title, due, and status skeleton cells', () => {
    render(<AssignmentListSkeleton count={1} />);
    const row = screen.getByTestId('skeleton-row');
    expect(row).toHaveClass('skeleton-row');

    // Check for skeleton elements
    expect(row.querySelector('.skeleton-course')).toBeInTheDocument();
    expect(row.querySelector('.skeleton-title')).toBeInTheDocument();
    expect(row.querySelector('.skeleton-due')).toBeInTheDocument();
    expect(row.querySelector('.skeleton-status')).toBeInTheDocument();
  });
});