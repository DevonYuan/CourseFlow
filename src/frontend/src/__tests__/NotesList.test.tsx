/**
 * NotesList Component Tests
 *
 * Integration-style tests for the notes container: empty state, rendering,
 * add/edit/delete flows, optimistic rollback + retry toast, keyboard access,
 * focus management, and loading skeleton.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { EntityId, IsoDateTime, Note } from '@backend/shared/types';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotesList } from '../components/notes/NotesList';
import { ToastProvider } from '../context/ToastContext';
import { useAssignmentDetailStore } from '../stores/assignmentDetailStore';

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const mockApi = {
  db: {
    assignments: { get: vi.fn() },
    subtasks: { list: vi.fn() },
    notes: {
      list: vi.fn<(assignmentId: string) => Promise<Result<Note[]>>>(),
      upsert: vi.fn<
        (input: { id?: string; assignmentId: string; content: string }) => Promise<Result<Note>>
      >(),
      delete: vi.fn<(id: string) => Promise<Result<void>>>(),
    },
  },
  onDbChanged: vi.fn<(cb: (payload: IpcEvents['db:changed']) => void) => () => void>(),
};

Object.defineProperty(window, 'api', {
  value: mockApi,
  writable: true,
  configurable: true,
});

const assignmentId = 'assignment-1' as EntityId;
const now = '2026-09-05T12:00:00.000Z' as IsoDateTime;

const note1: Note = {
  id: 'note-1' as EntityId,
  assignmentId,
  content: 'Existing note',
  createdAt: now,
  updatedAt: now,
};

function resetStore(notes: Note[] = [], isLoading = false): void {
  useAssignmentDetailStore.setState({
    assignment: null,
    subTasks: [],
    notes,
    isLoading,
    error: null,
    notFound: false,
    currentAssignmentId: assignmentId,
    _abortController: null,
    _eventUnsubscribe: null,
    _debouncedRefetch: null,
    _subTaskAssignmentMap: new Map(),
    _noteAssignmentMap: new Map(),
  });
}

function renderNotesList(): void {
  render(
    <ToastProvider>
      <NotesList assignmentId={assignmentId} />
    </ToastProvider>,
  );
}

const addNoteButton = (): HTMLElement => screen.getByRole('button', { name: 'Add a new note' });

describe('NotesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.onDbChanged.mockReturnValue(vi.fn());
    mockApi.db.assignments.get.mockResolvedValue({ ok: true, data: null });
    mockApi.db.subtasks.list.mockResolvedValue({ ok: true, data: [] });
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [] });
    resetStore([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the empty state and add button when there are no notes', async () => {
    renderNotesList();

    await waitFor(() => {
      expect(
        screen.getByText(/No notes yet — click .Add note. to start logging progress/i),
      ).toBeInTheDocument();
    });
    expect(addNoteButton()).toBeInTheDocument();
  });

  it('renders existing notes', async () => {
    resetStore([note1]);
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [note1] });

    renderNotesList();

    await waitFor(() => expect(screen.getByText('Existing note')).toBeInTheDocument());
    expect(screen.queryByText(/No notes yet/)).not.toBeInTheDocument();
  });

  it('shows a loading skeleton while loading', () => {
    resetStore([], true);
    renderNotesList();
    expect(screen.getByRole('status', { name: 'Loading notes' })).toBeInTheDocument();
  });

  it('adds a note via the editor and closes it on success', async () => {
    const user = userEvent.setup();
    const persisted: Note = {
      id: 'note-new' as EntityId,
      assignmentId,
      content: 'New note content',
      createdAt: now,
      updatedAt: now,
    };
    mockApi.db.notes.upsert.mockResolvedValue({ ok: true, data: persisted });

    renderNotesList();
    await waitFor(() => expect(addNoteButton()).toBeInTheDocument());

    await user.click(addNoteButton());
    const textarea = screen.getByPlaceholderText('Add a note about this assignment...');
    await user.type(textarea, 'New note content');
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(screen.getByText('New note content')).toBeInTheDocument());
    expect(mockApi.db.notes.upsert).toHaveBeenCalledWith({
      assignmentId,
      content: 'New note content',
    });
    // Editor closes and focus returns to the Add note button
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Add a note about this assignment...')).not.toBeInTheDocument();
      expect(addNoteButton()).toHaveFocus();
    });
  });

  it('edits a note inline and persists the change', async () => {
    const user = userEvent.setup();
    resetStore([note1]);
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [note1] });
    mockApi.db.notes.upsert.mockResolvedValue({
      ok: true,
      data: { ...note1, content: 'Updated note', updatedAt: '2026-09-05T13:00:00.000Z' as IsoDateTime },
    });

    renderNotesList();
    await waitFor(() => expect(screen.getByText('Existing note')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit note' }));

    const textarea = screen.getByPlaceholderText('Edit your note...');
    await user.clear(textarea);
    await user.type(textarea, 'Updated note');
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(screen.getByText('Updated note')).toBeInTheDocument());
    expect(mockApi.db.notes.upsert).toHaveBeenCalledWith({
      id: 'note-1',
      assignmentId,
      content: 'Updated note',
    });
  });

  it('deletes a note after confirmation', async () => {
    const user = userEvent.setup();
    resetStore([note1]);
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [note1] });
    mockApi.db.notes.delete.mockResolvedValue({ ok: true, data: undefined });

    renderNotesList();
    await waitFor(() => expect(screen.getByText('Existing note')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete note' }));

    // Confirmation modal appears
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete note?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockApi.db.notes.delete).toHaveBeenCalledWith('note-1'));
    await waitFor(() => expect(screen.queryByText('Existing note')).not.toBeInTheDocument());
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    resetStore([note1]);
    mockApi.db.notes.list.mockResolvedValue({ ok: true, data: [note1] });

    renderNotesList();
    await waitFor(() => expect(screen.getByText('Existing note')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Delete note' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockApi.db.notes.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Existing note')).toBeInTheDocument();
  });

  it('shows an error toast with Retry when saving fails, and keeps the editor open', async () => {
    const user = userEvent.setup();
    mockApi.db.notes.upsert.mockResolvedValue({ ok: false, error: 'Failed' });

    renderNotesList();
    await waitFor(() => expect(addNoteButton()).toBeInTheDocument());

    await user.click(addNoteButton());
    const textarea = screen.getByPlaceholderText('Add a note about this assignment...');
    await user.type(textarea, 'Will fail');
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(screen.getByText('Failed to save note')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // Editor stays open so the user can retry/edit
    expect(screen.getByPlaceholderText('Add a note about this assignment...')).toBeInTheDocument();
  });

  it('retries saving after a failure', async () => {
    const user = userEvent.setup();
    mockApi.db.notes.upsert.mockResolvedValueOnce({ ok: false, error: 'Failed' });
    mockApi.db.notes.upsert.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'note-retry' as EntityId,
        assignmentId,
        content: 'Retry me',
        createdAt: now,
        updatedAt: now,
      },
    });

    renderNotesList();
    await waitFor(() => expect(addNoteButton()).toBeInTheDocument());

    await user.click(addNoteButton());
    const textarea = screen.getByPlaceholderText('Add a note about this assignment...');
    await user.type(textarea, 'Retry me');
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(screen.getByText('Failed to save note')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mockApi.db.notes.upsert).toHaveBeenCalledTimes(2));
  });

  it('opens the editor via keyboard (Tab + Enter) and cancels with Escape', async () => {
    const user = userEvent.setup();
    renderNotesList();
    await waitFor(() => expect(addNoteButton()).toBeInTheDocument());

    await user.tab();
    expect(addNoteButton()).toHaveFocus();

    await user.keyboard('{Enter}');
    const textarea = screen.getByPlaceholderText('Add a note about this assignment...');
    expect(textarea).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Add a note about this assignment...'),
      ).not.toBeInTheDocument();
    });
  });
});
