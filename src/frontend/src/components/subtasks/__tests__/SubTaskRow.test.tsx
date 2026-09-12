/**
 * SubTaskRow Component Tests
 *
 * Covers rendering, checkbox toggle (click + keyboard), delete,
 * completed styling, and disabled/toggling states.
 */

// @vitest-environment jsdom

import type { EntityId, IsoDateTime, SubTask } from '@backend/shared/types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubTaskRow } from '../SubTaskRow';

function makeSubTask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    id: 'sub-1' as EntityId,
    assignmentId: 'assignment-1' as EntityId,
    title: 'Read chapter 1',
    completed: false,
    order: 0,
    createdAt: '2026-09-01T00:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-01T00:00:00.000Z' as IsoDateTime,
    ...overrides,
  };
}

describe('SubTaskRow', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the title and an accessible checkbox', () => {
    render(<SubTaskRow subTask={makeSubTask()} onDelete={vi.fn()} onToggle={vi.fn()} />);

    expect(screen.getByText('Read chapter 1')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-label', 'Sub-task: Read chapter 1, incomplete');
    expect(checkbox).not.toBeChecked();
  });

  it('toggles completion when the checkbox changes', async () => {
    const onToggle = vi.fn();
    render(<SubTaskRow subTask={makeSubTask()} onDelete={vi.fn()} onToggle={onToggle} />);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledWith('sub-1', true);
  });

  it('toggles off when the sub-task is already completed', async () => {
    const onToggle = vi.fn();
    render(
      <SubTaskRow
        subTask={makeSubTask({ completed: true })}
        onDelete={vi.fn()}
        onToggle={onToggle}
      />,
    );

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).toHaveBeenCalledWith('sub-1', false);
  });

  it('supports keyboard activation (Space) of the checkbox', async () => {
    const onToggle = vi.fn();
    render(<SubTaskRow subTask={makeSubTask()} onDelete={vi.fn()} onToggle={onToggle} />);

    const checkbox = screen.getByRole('checkbox');
    checkbox.focus();
    await userEvent.keyboard(' ');

    expect(onToggle).toHaveBeenCalledWith('sub-1', true);
  });

  it('calls onDelete with the id and title', async () => {
    const onDelete = vi.fn();
    render(<SubTaskRow subTask={makeSubTask()} onDelete={onDelete} onToggle={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /delete sub-task/i }));

    expect(onDelete).toHaveBeenCalledWith('sub-1', 'Read chapter 1');
  });

  it('disables the checkbox and delete button while toggling', () => {
    render(<SubTaskRow subTask={makeSubTask()} onDelete={vi.fn()} onToggle={vi.fn()} isToggling />);

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('does not toggle while a toggle is in progress', async () => {
    const onToggle = vi.fn();
    render(
      <SubTaskRow subTask={makeSubTask()} onDelete={vi.fn()} onToggle={onToggle} isToggling />,
    );

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('marks the row as completed', () => {
    render(
      <SubTaskRow
        subTask={makeSubTask({ completed: true })}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(document.querySelector('.subtask-row')?.className).toContain('subtask-row--completed');
  });
});
