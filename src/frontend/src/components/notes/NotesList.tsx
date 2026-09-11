/**
 * NotesList — Notes List Container Component
 *
 * Renders the list of notes for an assignment, including the add button,
 * empty state, and handles optimistic updates via the notes hook.
 *
 * @module @frontend/components/notes/NotesList
 */

import type { EntityId } from '@backend/shared/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '../../context/ToastContext';
import { useNotes } from '../../hooks/useNotes';
import { ConfirmModal } from '../ui/ConfirmModal';

import { NoteEntry } from './NoteEntry';
import { NotesEditor } from './NotesEditor';

import './Notes.css';

interface NotesListProps {
  /** The assignment ID to load notes for */
  assignmentId: EntityId;
}

/**
 * NotesList - Main container for notes in the assignment detail view.
 * Handles: loading, empty state, list rendering, add/edit/delete, live updates.
 */
export function NotesList({ assignmentId }: NotesListProps): JSX.Element {
  const { notes, isLoading, isSaving, fetchNotes, addNote, updateNote, deleteNote } =
    useNotes(assignmentId);

  const { error: showErrorToast } = useToast();

  const [editingNoteId, setEditingNoteId] = useState<EntityId | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<EntityId | null>(null);
  const [showAddEditor, setShowAddEditor] = useState(false);

  const addButtonRef = useRef<HTMLButtonElement>(null);

  // Initial fetch (lightweight when the detail page already loaded this assignment)
  useEffect(() => {
    void fetchNotes(assignmentId);
  }, [assignmentId, fetchNotes]);

  const focusAddButton = useCallback(() => {
    // Defer to allow React to re-render (button may be remounting)
    setTimeout(() => addButtonRef.current?.focus(), 0);
  }, []);

  // Handle "Add note" button click
  const handleAddClick = useCallback(() => {
    setShowAddEditor(true);
  }, []);

  // Handle save new note
  const handleAddSave = useCallback(
    async (content: string) => {
      const result = await addNote(assignmentId, content);
      if (result.ok) {
        setShowAddEditor(false);
        focusAddButton();
        return;
      }

      showErrorToast('Failed to save note', {
        duration: 5000,
        action: {
          label: 'Retry',
          onClick: () => {
            void handleAddSave(content);
          },
        },
      });
    },
    [assignmentId, addNote, showErrorToast, focusAddButton],
  );

  // Handle cancel new note
  const handleAddCancel = useCallback(() => {
    setShowAddEditor(false);
    focusAddButton();
  }, [focusAddButton]);

  // Handle edit note click
  const handleEditClick = useCallback((id: EntityId, content: string) => {
    setEditingNoteId(id);
    setEditingContent(content);
  }, []);

  // Handle save edited note
  const handleEditSave = useCallback(
    async (content: string) => {
      if (!editingNoteId) return;

      const result = await updateNote(editingNoteId, content);
      if (result.ok) {
        setEditingNoteId(null);
        setEditingContent('');
        focusAddButton();
        return;
      }

      showErrorToast('Failed to save note', {
        duration: 5000,
        action: {
          label: 'Retry',
          onClick: () => {
            void handleEditSave(content);
          },
        },
      });
    },
    [editingNoteId, updateNote, showErrorToast, focusAddButton],
  );

  // Handle cancel edit
  const handleEditCancel = useCallback(() => {
    setEditingNoteId(null);
    setEditingContent('');
    focusAddButton();
  }, [focusAddButton]);

  // Handle delete note click - open confirmation modal
  const handleDeleteClick = useCallback((id: EntityId) => {
    setDeleteTargetId(id);
  }, []);

  // Handle confirmed delete
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId) return;

    const idToDelete = deleteTargetId;
    setDeleteTargetId(null);
    const result = await deleteNote(idToDelete);
    if (!result.ok) {
      showErrorToast('Failed to delete note', {
        duration: 5000,
        action: {
          label: 'Retry',
          onClick: () => {
            void deleteNote(idToDelete);
          },
        },
      });
    }
  }, [deleteTargetId, deleteNote, showErrorToast]);

  // Handle delete cancel
  const handleDeleteCancel = useCallback(() => {
    setDeleteTargetId(null);
  }, []);

  // Show skeleton loaders while loading
  if (isLoading) {
    return (
      <div className="notes-list" role="status" aria-label="Loading notes">
        <div className="notes-list__skeleton" />
        <div className="notes-list__skeleton" />
        <div className="notes-list__skeleton short" />
      </div>
    );
  }

  return (
    <div className="notes-list">
      {/* Empty State */}
      {notes.length === 0 && (
        <div className="notes-list__empty">
          <p className="notes-list__empty-message">
            No notes yet — click &ldquo;Add note&rdquo; to start logging progress
          </p>
        </div>
      )}

      {/* Notes List */}
      {notes.length > 0 && (
        <ul className="notes-list__list" role="list" aria-label="Notes">
          {notes.map((note) =>
            editingNoteId === note.id ? (
              <li key={note.id} className="note-entry note-entry--editing">
                <NotesEditor
                  initialContent={editingContent}
                  onSave={(content) => {
                    void handleEditSave(content);
                  }}
                  onCancel={handleEditCancel}
                  placeholder="Edit your note..."
                  isSaving={isSaving}
                  autoFocus
                />
              </li>
            ) : (
              <NoteEntry
                key={note.id}
                note={note}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                isDeleting={deleteTargetId === note.id}
              />
            ),
          )}
        </ul>
      )}

      {/* Add Note Editor */}
      {showAddEditor && (
        <NotesEditor
          initialContent=""
          onSave={(content) => {
            void handleAddSave(content);
          }}
          onCancel={handleAddCancel}
          placeholder="Add a note about this assignment..."
          isSaving={isSaving}
          autoFocus
        />
      )}

      {/* Add Note Button (shown when not adding/editing) */}
      {!showAddEditor && editingNoteId === null && (
        <button
          ref={addButtonRef}
          type="button"
          className="notes-list__add-btn"
          onClick={handleAddClick}
          aria-label="Add a new note"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add note
        </button>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={deleteTargetId !== null}
        title="Delete note?"
        message="Are you sure you want to delete this note? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="destructive"
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
