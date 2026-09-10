/**
 * NoteEntry — Individual Note Display Component
 *
 * Renders a single note with content, timestamp, edited badge,
 * and edit/delete actions. Keyboard accessible.
 *
 * @module @frontend/components/notes/NoteEntry
 */

import type { Note, EntityId } from '@backend/shared/types';
import React from 'react';

import { formatRelativeTime } from '../../utils/date';

import './Notes.css';

interface NoteEntryProps {
  /** Note data to display */
  note: Note;
  /** Callback when edit is clicked */
  onEdit: (id: EntityId, content: string) => void;
  /** Callback when delete is clicked (opens confirmation) */
  onDelete: (id: EntityId, content: string) => void;
  /** Whether this note is being deleted */
  isDeleting?: boolean;
  /** Whether this note is being edited */
  isEditing?: boolean;
}

/**
 * NoteEntry - Single note item in the list.
 * Includes: content (pre-wrap), timestamp, "Edited" badge, Edit/Delete buttons.
 */
export function NoteEntry({
  note,
  onEdit,
  onDelete,
  isDeleting = false,
  isEditing = false,
}: NoteEntryProps): JSX.Element {
  const { id, content, createdAt, updatedAt } = note;

  // Determine if note was edited
  const isEdited = createdAt !== updatedAt;
  // Use updatedAt for display if edited, otherwise createdAt
  const displayTime = isEdited ? updatedAt : createdAt;

  const handleEditClick = () => {
    if (isEditing || isDeleting) return;
    onEdit(id, content);
  };

  const handleDeleteClick = () => {
    if (isEditing || isDeleting) return;
    onDelete(id, content);
  };

  // NOTE: content is rendered as React text (not HTML), so React escapes it
  // automatically. Do NOT pre-escape with escapeHtml(), or entities would be
  // shown literally (e.g. "&lt;script&gt;").
  return (
    <li
      className={`note-entry${isDeleting ? ' note-entry--deleting' : ''}${isEditing ? ' note-entry--editing' : ''}`}
      data-note-id={id}
    >
      <div className="note-entry__content" data-testid="note-content">
        {content}
      </div>

      <div className="note-entry__meta">
        <time className="note-entry__timestamp" dateTime={displayTime}>
          {formatRelativeTime(displayTime)}
        </time>
        {isEdited && (
          <span className="note-entry__edited-badge" aria-label="Edited">
            Edited
          </span>
        )}

        <div className="note-entry__actions">
          <button
            type="button"
            className="note-entry__action-btn note-entry__action-btn--edit"
            onClick={handleEditClick}
            aria-label={`Edit note`}
            disabled={isDeleting || isEditing}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            type="button"
            className="note-entry__action-btn note-entry__action-btn--delete"
            onClick={handleDeleteClick}
            aria-label={`Delete note`}
            disabled={isDeleting || isEditing}
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