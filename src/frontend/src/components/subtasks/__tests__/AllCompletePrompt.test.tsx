/**
 * AllCompletePrompt Component Tests
 *
 * Covers rendering, Mark Complete, Dismiss (persist + notify),
 * Escape dismissal, and reappearing when the dismissed prop changes.
 */

// @vitest-environment jsdom

import type { EntityId } from '@backend/shared/types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setPromptDismissed } from '../../../utils/localStorage';
import { AllCompletePrompt } from '../AllCompletePrompt';

vi.mock('../../../utils/localStorage', () => ({
  isPromptDismissed: vi.fn(() => false),
  setPromptDismissed: vi.fn(),
  clearPromptDismissed: vi.fn(),
}));

const assignmentId = 'assignment-1' as EntityId;

describe('AllCompletePrompt', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders nothing when dismissed', () => {
    const { container } = render(
      <AllCompletePrompt
        assignmentId={assignmentId}
        onMarkComplete={vi.fn()}
        dismissed
        onDismissChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the prompt with both actions', () => {
    render(
      <AllCompletePrompt
        assignmentId={assignmentId}
        onMarkComplete={vi.fn()}
        dismissed={false}
        onDismissChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('All sub-tasks done');
    expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('calls onMarkComplete when Mark Complete is clicked', async () => {
    const onMarkComplete = vi.fn().mockResolvedValue(undefined);
    render(
      <AllCompletePrompt
        assignmentId={assignmentId}
        onMarkComplete={onMarkComplete}
        dismissed={false}
        onDismissChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Mark Complete' }));

    expect(onMarkComplete).toHaveBeenCalledTimes(1);
  });

  it('persists dismissal and notifies the parent when Dismiss is clicked', async () => {
    const onDismissChange = vi.fn();
    render(
      <AllCompletePrompt
        assignmentId={assignmentId}
        onMarkComplete={vi.fn()}
        dismissed={false}
        onDismissChange={onDismissChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(setPromptDismissed).toHaveBeenCalledWith(assignmentId, true);
    expect(onDismissChange).toHaveBeenCalledWith(true);
  });

  it('dismisses on Escape', async () => {
    const onDismissChange = vi.fn();
    render(
      <AllCompletePrompt
        assignmentId={assignmentId}
        onMarkComplete={vi.fn()}
        dismissed={false}
        onDismissChange={onDismissChange}
      />,
    );

    await userEvent.keyboard('{Escape}');

    expect(onDismissChange).toHaveBeenCalledWith(true);
  });

  it('reappears when the dismissed prop changes from true to false', () => {
    const { rerender } = render(
      <AllCompletePrompt
        assignmentId={assignmentId}
        onMarkComplete={vi.fn()}
        dismissed
        onDismissChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(
      <AllCompletePrompt
        assignmentId={assignmentId}
        onMarkComplete={vi.fn()}
        dismissed={false}
        onDismissChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
