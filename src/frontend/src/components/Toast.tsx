/**
 * Toast — Individual Toast Notification
 *
 * Displays a single toast with type-specific styling and dismiss button.
 * Supports keyboard dismiss (Escape) and auto-dismiss timer.
 *
 * @module @frontend/components/Toast
 */

import React from 'react';
import { useEffect, useRef } from 'react';

import type { Toast as ToastType, ToastType as ToastTypeEnum } from '../context/ToastContext';
import './Toast.css';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const typeIcons: Record<ToastTypeEnum, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const typeLabels: Record<ToastTypeEnum, string> = {
  success: 'Success',
  error: 'Error',
  info: 'Information',
  warning: 'Warning',
};

/**
 * Individual toast notification with animation and accessibility.
 */
export function Toast({ toast, onDismiss }: ToastProps): JSX.Element {
  const toastRef = useRef<HTMLDivElement>(null);

  // Trigger enter animation
  useEffect(() => {
    const element = toastRef.current;
    if (element) {
      // Force reflow then add enter class
      void element.offsetHeight; // trigger reflow
      element.classList.add('toast--enter');
    }
  }, []);

  // Handle escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss(toast.id);
      }
    };

    const element = toastRef.current;
    element?.addEventListener('keydown', handleKeyDown);
    return () => element?.removeEventListener('keydown', handleKeyDown);
  }, [toast.id, onDismiss]);

  const handleClick = () => onDismiss(toast.id);

  const role = toast.type === 'error' ? 'alert' : 'status';
  const ariaLive = toast.type === 'error' ? 'assertive' : 'polite';

  return (
    <div
      ref={toastRef}
      className={`toast toast--${toast.type}`}
      role={role}
      aria-live={ariaLive}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleClick}
    >
      <div className="toast__icon" aria-hidden="true">
        {typeIcons[toast.type]}
      </div>
      <div className="toast__content">
        <span className="toast__type" aria-hidden="true">
          {typeLabels[toast.type]}
        </span>
        <p className="toast__message">{toast.message}</p>
      </div>
      <button
        className="toast__dismiss"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        aria-label={`Dismiss ${typeLabels[toast.type].toLowerCase()} toast`}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}