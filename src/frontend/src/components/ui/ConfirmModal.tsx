/**
 * ConfirmModal — Generic Confirmation Dialog Component
 *
 * Accessible modal for confirming destructive or important actions.
 * Features: focus trap, Escape to close, configurable button labels/variants,
 * and proper ARIA attributes.
 *
 * @module @frontend/components/ui/ConfirmModal
 */

import React, { useRef } from 'react';
import { createPortal } from 'react-dom';

import { useFocusTrap } from '../../hooks/useFocusTrap';
import './ConfirmModal.css';

export type ConfirmVariant = 'destructive' | 'primary' | 'secondary';

export interface ConfirmModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Modal title */
  title: string;
  /** Modal message/description */
  message: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Variant of the confirm button */
  confirmVariant?: ConfirmVariant;
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Callback when user cancels or closes modal */
  onCancel: () => void;
  /** Whether to show the cancel button (default: true) */
  showCancel?: boolean;
  /** Whether the confirm action is loading */
  isLoading?: boolean;
}

/**
 * ConfirmModal - Generic accessible confirmation dialog.
 * - Focus trap within modal
 * - Escape key closes
 * - Cancel button focused by default (safer default)
 * - Configurable button variants and labels
 * - Renders as portal to document.body for proper stacking
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'destructive',
  onConfirm,
  onCancel,
  showCancel = true,
  isLoading = false,
}: ConfirmModalProps): React.ReactPortal | null {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Use the focus trap hook
  const containerRef = useFocusTrap({
    isActive: open,
    onEscape: onCancel,
    initialFocusRef: cancelButtonRef,
  });

  if (!open) return null;

  const variantClasses: Record<ConfirmVariant, string> = {
    destructive: 'modal__button--delete',
    primary: 'modal__button--primary',
    secondary: 'modal__button--secondary',
  };

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
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <h2 id="confirm-modal-title" className="modal__title">
          {title}
        </h2>
        <p id="confirm-modal-message" className="modal__message">
          {message}
        </p>
        <div className="modal__actions">
          {showCancel && (
            <button
              ref={cancelButtonRef}
              type="button"
              className="modal__button modal__button--cancel"
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            type="button"
            className={`modal__button ${variantClasses[confirmVariant]}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  // Render as portal to body for proper stacking
  return createPortal(modalContent, document.body);
}
