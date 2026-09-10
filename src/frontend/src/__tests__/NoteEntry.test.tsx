/**
 * NoteEntry Component Tests
 *
 * Covers content rendering (plain text, XSS safe), edited badge,
 * timestamps, and edit/delete action callbacks.
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

  it('renders the note content and a timestamp', () => {
    render(<NoteEntry note={makeNote()} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByTestId('note-content')).toHaveTextContent('Worked on the intro');
    expect(screen.getByText(/ago|AM|PM/)).toBeInTheDocument();
  });

  it('does not show the Edited badge for an unedited note', () => {
    render(<NoteEntry note={makeNote()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('Edited')).not.toBeInTheDocument();
  });

  it('shows the Edited badge when updatedAt differs from createdAt', () => {
    render(
      <NoteEntry
        note={makeNote({ updatedAt: '2026-09-06T12:00:00.000Z' as IsoDateTime })}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Edited')).toBeInTheDocument();
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
});
