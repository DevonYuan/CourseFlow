/**
 * SubTaskRow — Individual Sub-task Row Component
 *
 * Renders a single sub-task with interactive checkbox, title, drag handle (placeholder),
 * and delete button. Keyboard accessible and screen reader friendly.
 *
 * @module @frontend/components/subtasks/SubTaskRow
 */

import type { SubTask, EntityId } from '@backend/shared/types';
import React from 'react';

interface SubTaskRowProps {
  /** Sub-task data to display */
  subTask: SubTask;
  /** Callback when delete is clicked (opens confirmation) */
  onDelete: (id: EntityId, title: string) => void;
  /** Callback when checkbox is toggled */
  onToggle: (id: EntityId, completed: boolean) => void | Promise<void>;
  /** Whether this row is the target of a delete confirmation */
  isDeleting?: boolean;
  /** Whether a toggle operation is in progress */
  isToggling?: boolean;
}

/**
 * SubTaskRow - Single sub-task item in the list.
 * Includes: interactive checkbox, title, drag handle placeholder, delete button.
 */
export function SubTaskRow({
  subTask,
  onDelete,
  onToggle,
  isDeleting = false,
  isToggling = false,
}: SubTaskRowProps): JSX.Element {
  const { completed, title, id } = subTask;

  const handleCheckboxChange = () => {
    if (isToggling) return;
    void onToggle(id, !completed);
  };

  return (
    <li
      className={`subtask-row${completed ? ' subtask-row--completed' : ''}${isDeleting ? ' subtask-row--deleting' : ''}${isToggling ? ' subtask-row--toggling' : ''}`}
      data-subtask-id={id}
    >
      {/* Completion checkbox */}
      <label className="subtask-row__checkbox-wrapper">
        <input
          type="checkbox"
          className="subtask-row__checkbox"
          checked={completed}
          onChange={handleCheckboxChange}
          disabled={isToggling}
          aria-checked={completed}
          aria-label={`Sub-task: ${title}, ${completed ? 'completed' : 'incomplete'}`}
        />
        <span className="subtask-row__checkbox-visual" aria-hidden="true" />
      </label>

      {/* Sub-task title */}
      <span className="subtask-row__title">{title}</span>

      {/* Drag handle placeholder (for future reordering) */}
      <button
        type="button"
        className="subtask-row__drag-handle"
        aria-hidden="true"
        tabIndex={-1}
        title="Drag to reorder (coming soon)"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="9" cy="5" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </button>

      {/* Delete button */}
      <button
        type="button"
        className="subtask-row__delete"
        onClick={() => onDelete(id, title)}
        aria-label={`Delete sub-task: ${title}`}
        disabled={isDeleting || isToggling}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </li>
  );
}
