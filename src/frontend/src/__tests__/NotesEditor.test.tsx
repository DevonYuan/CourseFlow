/**
 * NotesEditor Component Tests
 *
 * Covers character count, Ctrl/Cmd+Enter save, Escape cancel, save-button
 * behavior, saving indicator, and Tab indentation.
 */

// @vitest-environment jsdom

import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotesEditor } from '../components/notes/NotesEditor';

describe('NotesEditor', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the textarea with the placeholder and character count', () => {
    render(<NotesEditor onSave={vi.fn()} onCancel={vi.fn()} placeholder="Add a note..." />);

    expect(screen.getByPlaceholderText('Add a note...')).toBeInTheDocument();
    expect(screen.getByText(/\/ 10000 characters/)).toHaveTextContent('0 / 10000 characters');
  });

  it('updates the character count as the user types', async () => {
    const user = userEvent.setup();
    render(<NotesEditor onSave={vi.fn()} onCancel={vi.fn()} />);

    const textarea = screen.getByLabelText('Note content');
    await user.type(textarea, 'Hello');

    expect(screen.getByText(/\/ 10000 characters/)).toHaveTextContent('5 / 10000 characters');
  });

  it('saves trimmed content on Ctrl+Enter', () => {
    const onSave = vi.fn();
    render(<NotesEditor initialContent="  Draft note  " onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.keyDown(screen.getByLabelText('Note content'), {
      key: 'Enter',
      ctrlKey: true,
    });

    expect(onSave).toHaveBeenCalledWith('Draft note');
  });

  it('saves on Cmd+Enter (macOS)', () => {
    const onSave = vi.fn();
    render(<NotesEditor initialContent="Note" onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.keyDown(screen.getByLabelText('Note content'), {
      key: 'Enter',
      metaKey: true,
    });

    expect(onSave).toHaveBeenCalledWith('Note');
  });

  it('does not save empty or whitespace-only content on Ctrl+Enter', () => {
    const onSave = vi.fn();
    render(<NotesEditor initialContent="   " onSave={onSave} onCancel={vi.fn()} />);

    fireEvent.keyDown(screen.getByLabelText('Note content'), {
      key: 'Enter',
      ctrlKey: true,
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels on Escape', () => {
    const onCancel = vi.fn();
    render(<NotesEditor initialContent="Note" onSave={vi.fn()} onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByLabelText('Note content'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables Save when content is empty', () => {
    render(<NotesEditor initialContent="" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('saves via the Save button', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<NotesEditor initialContent="Button save" onSave={onSave} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith('Button save');
  });

  it('shows a saving indicator and disables actions while saving', () => {
    render(<NotesEditor initialContent="Note" onSave={vi.fn()} onCancel={vi.fn()} isSaving />);

    expect(screen.getByText('Saving…')).toBeInTheDocument();
    expect(screen.getByLabelText('Note content')).toBeDisabled();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('inserts two spaces when Tab is pressed instead of moving focus', async () => {
    const user = userEvent.setup();
    render(<NotesEditor initialContent="" onSave={vi.fn()} onCancel={vi.fn()} />);

    const textarea = screen.getByLabelText('Note content') as HTMLTextAreaElement;
    textarea.focus();
    await user.keyboard('{Tab}');

    expect(textarea.value).toBe('  ');
    expect(textarea).toHaveFocus();
  });

  it('enforces the 10,000 character limit via maxLength', () => {
    render(<NotesEditor onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Note content')).toHaveAttribute('maxlength', '10000');
  });

  it('auto-focuses the textarea when autoFocus is set', () => {
    render(<NotesEditor initialContent="x" onSave={vi.fn()} onCancel={vi.fn()} autoFocus />);
    expect(screen.getByLabelText('Note content')).toHaveFocus();
  });
});
