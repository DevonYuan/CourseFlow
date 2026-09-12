/**
 * ProgressBar Component Tests
 *
 * Covers ARIA attributes, value clamping, sizes, labels,
 * custom colors, and keyboard activation.
 */

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a progressbar with the correct ARIA values', () => {
    render(<ProgressBar value={42} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps values below 0 and above 100', () => {
    const { rerender } = render(<ProgressBar value={-20} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    rerender(<ProgressBar value={140} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('builds a default aria-label from the label and value', () => {
    render(<ProgressBar value={60} label="3/5" />);

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-label',
      'Sub-task progress: 3/5, 60 percent',
    );
  });

  it('uses a custom aria-label when provided', () => {
    render(<ProgressBar value={10} ariaLabel="Custom progress" />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-label', 'Custom progress');
  });

  it('shows the label and percentage when requested', () => {
    render(<ProgressBar value={75} label="3/4" showPercentage />);

    expect(screen.getByText('3/4')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size class', (size) => {
    render(<ProgressBar value={50} size={size} />);

    expect(screen.getByRole('progressbar').className).toContain(`progress-bar--${size}`);
  });

  it('applies a custom color as a CSS custom property', () => {
    render(<ProgressBar value={50} color="#ff0000" />);

    expect(screen.getByRole('progressbar').style.getPropertyValue('--progress-color')).toBe(
      '#ff0000',
    );
  });

  it('is not focusable without an onClick handler', () => {
    render(<ProgressBar value={50} />);

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('tabindex');
  });

  it('activates onClick via click', async () => {
    const onClick = vi.fn();
    render(<ProgressBar value={50} onClick={onClick} />);

    await userEvent.click(screen.getByRole('progressbar'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('activates onClick via Enter and Space keys', async () => {
    const onClick = vi.fn();
    render(<ProgressBar value={50} onClick={onClick} />);

    const bar = screen.getByRole('progressbar');
    bar.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');

    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
