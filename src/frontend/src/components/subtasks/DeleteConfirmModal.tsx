/**
 * DeleteConfirmModal — Delete Confirmation Modal Component
 *
 * Accessible modal for confirming sub-task deletion. Focus trap,
 * Escape to close, Cancel focused by default, Delete is destructive.
 *
 * @module @frontend/components/subtasks/DeleteConfirmModal
 */

import React, { useRef } from 'react';
import { createPortal } from 'react-dom';

import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DeleteConfirmModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Title of the sub-task being deleted (for message) */
  subTaskTitle: string;
  /** Callback when user confirms deletion */
  onConfirm: () => void;
  /** Callback when user cancels or closes modal */
  onCancel: () => void;
}

/**
 * DeleteConfirmModal - Accessible confirmation dialog.
 * - Focus trap within modal
 * - Escape key closes
 * - Cancel button focused by default (safer default)
 * - Delete button styled as destructive
 */
export function DeleteConfirmModal({
  open,
  subTaskTitle,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps): React.ReactPortal | null {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Use the focus trap hook
  const containerRef = useFocusTrap({
    isActive: open,
    onEscape: onCancel,
    initialFocusRef: cancelButtonRef,
  });

  if (!open) return null;

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="presentation"
    >
      <div
        ref={containerRef}
        className="modal modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        aria-describedby="delete-confirm-message"
      >
        <h2 id="delete-confirm-title" className="modal__title">
          Delete sub-task?
        </h2>
        <p id="delete-confirm-message" className="modal__message">
          Are you sure you want to delete &ldquo;{subTaskTitle}&rdquo;? This cannot be undone.
        </p>
        <div className="modal__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="modal__button modal__button--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button type="button" className="modal__button modal__button--delete" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  // Render as portal to body for proper stacking
  return createPortal(modalContent, document.body);
}
