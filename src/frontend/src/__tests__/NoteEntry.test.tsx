/**
 * NoteEntry Component Tests
 *
 * Covers content rendering (plain text, XSS safe), edited badge,
 * timestamps (updated + created), and edit/delete action callbacks.
 */

// @vitest-environment jsdom

import type { EntityId, IsoDateTime, Note } from '@backend/shared/types';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NoteEntry } from '../components/notes/NoteEntry';

const assignmentId = 'assignment-1' as EntityId;

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1' as EntityId,
    assignmentId,
    content: 'Worked on the intro',
    createdAt: '2026-09-05T12:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-05T12:00:00.000Z' as IsoDateTime,
    ...overrides,
  };
}

describe('NoteEntry', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the note content and both timestamps', () => {
    render(<NoteEntry note={makeNote()} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByTestId('note-content')).toHaveTextContent('Worked on the intro');
    // Updated timestamp (primary)
    expect(screen.getByTestId('note-updated-timestamp')).toBeInTheDocument();
    // Created timestamp (secondary) - should show "Created ..."
    expect(screen.getByTestId('note-created-timestamp')).toBeInTheDocument();
  });

  it('does not show the Edited badge for an unedited note (within 5s threshold)', () => {
    // updatedAt is only 1 second after createdAt - below 5s threshold
    render(<NoteEntry note={makeNote({ updatedAt: '2026-09-05T12:00:01.000Z' as IsoDateTime })} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByTestId('note-edited-badge')).not.toBeInTheDocument();
  });

  it('shows the Edited badge when updatedAt is more than 5s after createdAt', () => {
    // updatedAt is 10 seconds after createdAt - above 5s threshold
    render(
      <NoteEntry
        note={makeNote({ updatedAt: '2026-09-05T12:00:10.000Z' as IsoDateTime })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByTestId('note-edited-badge')).toBeInTheDocument();
  });

  it('shows the Edited badge with proper aria-label', () => {
    render(
      <NoteEntry
        note={makeNote({ updatedAt: '2026-09-05T12:00:10.000Z' as IsoDateTime })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const badge = screen.getByTestId('note-edited-badge');
    expect(badge).toHaveAttribute('aria-label', 'This note was edited after creation');
  });

  it('calls onEdit with the note id and content', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<NoteEntry note={makeNote()} onEdit={onEdit} onDelete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Edit note' }));

    expect(onEdit).toHaveBeenCalledWith('note-1', 'Worked on the intro');
  });

  it('calls onDelete with the note id and content', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<NoteEntry note={makeNote()} onEdit={vi.fn()} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: 'Delete note' }));

    expect(onDelete).toHaveBeenCalledWith('note-1', 'Worked on the intro');
  });

  it('renders HTML-looking content as literal text (XSS safe)', () => {
    const malicious = '<script>alert("xss")</script> & <b>bold</b>';
    render(<NoteEntry note={makeNote({ content: malicious })} onEdit={vi.fn()} onDelete={vi.fn()} />);

    const content = screen.getByTestId('note-content');
    // Rendered as plain text, not parsed HTML
    expect(content.textContent).toBe(malicious);
    expect(document.querySelector('script')).toBeNull();
    expect(content.querySelector('b')).toBeNull();
  });

  it('disables actions while deleting', () => {
    render(<NoteEntry note={makeNote()} onEdit={vi.fn()} onDelete={vi.fn()} isDeleting />);
    expect(screen.getByRole('button', { name: 'Edit note' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeDisabled();
  });

  it('disables actions while editing', () => {
    render(<NoteEntry note={makeNote()} onEdit={vi.fn()} onDelete={vi.fn()} isEditing />);
    expect(screen.getByRole('button', { name: 'Edit note' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeDisabled();
  });

  it('shows created timestamp with relative format', () => {
    // createdAt is in the past
    render(<NoteEntry note={makeNote({ createdAt: '2026-09-04T12:00:00.000Z' as IsoDateTime })} onEdit={vi.fn()} onDelete={vi.fn()} />);
    // Should show "Created X ago" format
    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });
});
