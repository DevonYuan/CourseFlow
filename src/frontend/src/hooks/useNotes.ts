/**
 * useNotes Hook — Notes Data Loading & Mutations
 *
 * Custom hook wrapping the assignment detail store + IPC calls for notes.
 * Handles fetching, adding, updating, and deleting with optimistic updates
 * and rollback on failure. Error toasts are surfaced by the consuming component.
 *
 * @module @frontend/hooks/useNotes
 */

import type { IpcResult } from '@backend/shared/ipc';
import type { EntityId, IsoDateTime, Note } from '@backend/shared/types';
import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { useAssignmentDetailStore } from '../stores/assignmentDetailStore';

interface UseNotesReturn {
  /** Current notes list (newest first) */
  notes: Note[];
  /** Whether the initial detail fetch is in progress */
  isLoading: boolean;
  /** Error message if the fetch failed */
  error: string | null;
  /** Whether a save/delete mutation is currently in flight */
  isSaving: boolean;
  /** Fetches notes for the given assignment */
  fetchNotes: (assignmentId: EntityId) => Promise<void>;
  /** Adds a new note (optimistic + IPC, rollback on failure) */
  addNote: (assignmentId: EntityId, content: string) => Promise<IpcResult<Note>>;
  /** Updates an existing note (optimistic + IPC, rollback on failure) */
  updateNote: (noteId: EntityId, content: string) => Promise<IpcResult<Note>>;
  /** Deletes a note (optimistic + IPC, rollback on failure) */
  deleteNote: (noteId: EntityId) => Promise<IpcResult<void>>;
}

/**
 * Generates a temporary ID for optimistic inserts before the backend
 * assigns a real UUID. Prefixed so it can be distinguished in tests/debugging.
 */
let tempNoteCounter = 0;
function createTempNoteId(): EntityId {
  tempNoteCounter += 1;
  return `temp-note-${Date.now()}-${tempNoteCounter}` as EntityId;
}

/**
 * Custom hook for note operations.
 * Wraps the Zustand store and IPC calls.
 *
 * @param assignmentId - The assignment ID to load notes for
 */
export function useNotes(assignmentId: EntityId): UseNotesReturn {
  const { notes, isLoading, error, addNote, updateNote, removeNote } =
    useAssignmentDetailStore(
      useShallow((state) => ({
        notes: state.notes,
        isLoading: state.isLoading,
        error: state.error,
        addNote: state.addNote,
        updateNote: state.updateNote,
        removeNote: state.removeNote,
      })),
    );

  const [isSaving, setIsSaving] = useState(false);

  /**
   * Ensures notes are loaded for the assignment. If the detail store is already
   * viewing this assignment, performs a lightweight notes-only refetch (no page
   * skeleton); otherwise performs a full detail fetch.
   */
  const fetchNotes = useCallback(
    async (id: EntityId = assignmentId) => {
      const { currentAssignmentId, fetch: storeFetch, refetchNotes: storeRefetch } =
        useAssignmentDetailStore.getState();
      await (currentAssignmentId === id ? storeRefetch() : storeFetch(id));
    },
    [assignmentId],
  );

  // Add note (optimistic)
  const handleAddNote = useCallback(
    async (id: EntityId, content: string): Promise<IpcResult<Note>> => {
      const trimmed = content.trim();
      const tempId = createTempNoteId();
      const now = new Date().toISOString() as IsoDateTime;
      const optimisticNote: Note = {
        id: tempId,
        assignmentId: id,
        content: trimmed,
        createdAt: now,
        updatedAt: now,
      };

      // Optimistically show the new note immediately
      addNote(optimisticNote);
      setIsSaving(true);

      try {
        const result = await window.api.db.notes.upsert({ assignmentId: id, content: trimmed });
        if (result.ok) {
          // Replace the optimistic entry with the persisted one
          removeNote(tempId);
          addNote(result.data);
        } else {
          // Roll back the optimistic entry
          removeNote(tempId);
        }
        return result;
      } catch (err) {
        removeNote(tempId);
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to add note',
        };
      } finally {
        setIsSaving(false);
      }
    },
    [addNote, removeNote],
  );

  // Update note (optimistic)
  const handleUpdateNote = useCallback(
    async (noteId: EntityId, content: string): Promise<IpcResult<Note>> => {
      const trimmed = content.trim();
      const previous = notes.find((n) => n.id === noteId);
      if (!previous) {
        return { ok: false, error: 'Note not found' };
      }

      const optimisticNote: Note = {
        ...previous,
        content: trimmed,
        updatedAt: new Date().toISOString() as IsoDateTime,
      };
      updateNote(optimisticNote);
      setIsSaving(true);

      try {
        const result = await window.api.db.notes.upsert({
          id: noteId,
          assignmentId: previous.assignmentId,
          content: trimmed,
        });
        if (result.ok) {
          updateNote(result.data);
        } else {
          // Restore the previous content
          updateNote(previous);
        }
        return result;
      } catch (err) {
        updateNote(previous);
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to update note',
        };
      } finally {
        setIsSaving(false);
      }
    },
    [notes, updateNote],
  );

  // Delete note (optimistic)
  const handleDeleteNote = useCallback(
    async (noteId: EntityId): Promise<IpcResult<void>> => {
      const previous = notes.find((n) => n.id === noteId);
      removeNote(noteId);
      setIsSaving(true);

      try {
        const result = await window.api.db.notes.delete(noteId);
        if (!result.ok && previous) {
          // Roll back by re-adding the deleted note
          addNote(previous);
        }
        return result;
      } catch (err) {
        if (previous) {
          addNote(previous);
        }
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Failed to delete note',
        };
      } finally {
        setIsSaving(false);
      }
    },
    [notes, addNote, removeNote],
  );

  return {
    notes,
    isLoading,
    error,
    isSaving,
    fetchNotes,
    addNote: handleAddNote,
    updateNote: handleUpdateNote,
    deleteNote: handleDeleteNote,
  };
}