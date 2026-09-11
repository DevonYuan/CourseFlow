/**
 * NoteEntry — Individual Note Display Component
 *
 * Displays a single note with content, timestamps (updated/created),
 * edited badge, and edit/delete actions.
 *
 * @module @frontend/components/notes/NoteEntry
 */

import type { EntityId, Note } from '@backend/shared/types';
import React, { useMemo } from 'react';

import { formatRelative, formatAbsolute, isEdited } from '../../utils/timestamp';
import { Tooltip } from '../ui/Tooltip';

import './Notes.css';

export interface NoteEntryProps {
  /** The note to display */
  note: Note;
  /** Callback when edit button is clicked */
  onEdit: (noteId: EntityId, content: string) => void;
  /** Callback when delete button is clicked */
  onDelete: (noteId: EntityId, content: string) => void;
  /** Whether the note is currently being deleted */
  isDeleting?: boolean;
  /** Whether the note is currently being edited */
  isEditing?: boolean;
}

/**
 * NoteEntry - Displays a single note in the list.
 * Features:
 * - Note content (XSS-safe, rendered as plain text)
 * - Updated timestamp with tooltip for absolute time
 * - Created timestamp (secondary, smaller)
 * - "Edited" badge if note was modified after creation
 * - Edit and delete buttons
 */
export function NoteEntry({
  note,
  onEdit,
  onDelete,
  isDeleting = false,
  isEditing = false,
}: NoteEntryProps): JSX.Element {
  // Determine if note was edited (more than 5 seconds after creation)
  const wasEdited = useMemo(() => isEdited(note.createdAt, note.updatedAt), [note.createdAt, note.updatedAt]);

  // Format timestamps for display
  const updatedRelative = formatRelative(note.updatedAt);
  const updatedAbsolute = formatAbsolute(note.updatedAt);
  const createdRelative = formatRelative(note.createdAt);
  const createdAbsolute = formatAbsolute(note.createdAt);

  // Handle edit click
  const handleEditClick = () => {
    if (isDeleting || isEditing) return;
    onEdit(note.id, note.content);
  };

  // Handle delete click
  const handleDeleteClick = () => {
    if (isDeleting || isEditing) return;
    onDelete(note.id, note.content);
  };

  return (
    <li className="note-entry" role="listitem">
      <div className="note-entry__content" data-testid="note-content">
        {note.content}
      </div>

      <div className="note-entry__meta">
        {/* Timestamps */}
        <div className="note-entry__timestamps">
          {/* Updated timestamp (primary) with tooltip */}
          <Tooltip content={updatedAbsolute} position="top" delay={200}>
            <span
              className="note-entry__timestamp note-entry__timestamp--updated"
              tabIndex={0}
              aria-label={`Updated at ${updatedAbsolute}`}
              data-testid="note-updated-timestamp"
            >
              {updatedRelative}
            </span>
          </Tooltip>

          {/* Edited badge (only if edited) */}
          {wasEdited && (
            <span
              className="note-entry__edited-badge"
              aria-label="This note was edited after creation"
              data-testid="note-edited-badge"
            >
              Edited
            </span>
          )}

          {/* Created timestamp (secondary) with tooltip */}
          <Tooltip content={createdAbsolute} position="top" delay={200}>
            <span
              className="note-entry__timestamp note-entry__timestamp--created"
              tabIndex={0}
              aria-label={`Created at ${createdAbsolute}`}
              data-testid="note-created-timestamp"
            >
              Created {createdRelative}
            </span>
          </Tooltip>
        </div>

        {/* Action buttons */}
        <div className="note-entry__actions">
          <button
            type="button"
            className="note-entry__action-btn note-entry__action-btn--edit"
            onClick={handleEditClick}
            disabled={isDeleting || isEditing}
            aria-label="Edit note"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="9" cy="5" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="9" cy="12" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </button>

          <button
            type="button"
            className="note-entry__action-btn note-entry__action-btn--delete"
            onClick={handleDeleteClick}
            disabled={isDeleting || isEditing}
            aria-label="Delete note"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </li>
  );
}