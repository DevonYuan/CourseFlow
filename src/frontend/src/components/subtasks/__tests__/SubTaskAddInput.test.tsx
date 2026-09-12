/**
 * SubTaskAddInput Component Tests
 *
 * Covers auto-focus, Enter to add, Escape to clear, and validation
 * (empty input, max length), plus the disabled state.
 */

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubTaskAddInput } from '../SubTaskAddInput';

describe('SubTaskAddInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('auto-focuses on mount', () => {
    render(<SubTaskAddInput onAdd={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Add sub-task' })).toHaveFocus();
  });

  it('adds a trimmed sub-task on Enter and clears the input', async () => {
    const onAdd = vi.fn();
    render(<SubTaskAddInput onAdd={onAdd} />);
    const input = screen.getByRole('textbox', { name: 'Add sub-task' });

    await userEvent.type(input, '  New task  {Enter}');

    expect(onAdd).toHaveBeenCalledWith('New task');
    expect(input).toHaveValue('');
  });

  it('shows a validation error and does not add when empty', async () => {
    const onAdd = vi.fn();
    render(<SubTaskAddInput onAdd={onAdd} />);

    await userEvent.type(screen.getByRole('textbox', { name: 'Add sub-task' }), '   {Enter}');

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('cannot be empty');
    expect(screen.getByRole('textbox', { name: 'Add sub-task' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows a validation error for titles longer than 200 characters', () => {
    const onAdd = vi.fn();
    render(<SubTaskAddInput onAdd={onAdd} />);
    const input = screen.getByRole('textbox', { name: 'Add sub-task' });

    fireEvent.change(input, { target: { value: 'x'.repeat(201) } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('200 characters or less');
  });

  it('clears the value and error on Escape', async () => {
    const onAdd = vi.fn();
    render(<SubTaskAddInput onAdd={onAdd} />);
    const input = screen.getByRole('textbox', { name: 'Add sub-task' });

    await userEvent.type(input, 'Draft{Escape}');

    expect(input).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('does not add on Enter when disabled', async () => {
    const onAdd = vi.fn();
    render(<SubTaskAddInput onAdd={onAdd} disabled />);

    await userEvent.type(screen.getByRole('textbox', { name: 'Add sub-task' }), 'Task{Enter}');

    expect(onAdd).not.toHaveBeenCalled();
  });
});
