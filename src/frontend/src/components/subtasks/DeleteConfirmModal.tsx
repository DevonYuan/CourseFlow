/**
 * DeleteConfirmModal — Delete Confirmation Modal Component
 *
 * Accessible modal for confirming sub-task deletion. Focus trap,
 * Escape to close, Cancel focused by default, Delete is destructive.
 *
 * @module @frontend/components/subtasks/DeleteConfirmModal
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management and trap
  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus Cancel button by default (safer)
      setTimeout(() => cancelButtonRef.current?.focus(), 0);

      // Trap focus
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
          return;
        }

        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = Array.from(
            modalRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          );
          const firstElement = focusableElements[0];
          const lastElement = focusableElements.at(-1);

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, onCancel]);

  // Restore focus on close
  useEffect(() => {
    if (!open && previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [open]);

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
        ref={modalRef}
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
          <button
            type="button"
            className="modal__button modal__button--delete"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  // Render as portal to body for proper stacking
  return createPortal(modalContent, document.body);
}