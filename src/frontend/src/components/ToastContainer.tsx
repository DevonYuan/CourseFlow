/**
 * ToastContainer — Portal-based Toast Container
 *
 * Renders toasts in a fixed position container (top-right).
 * Handles stacking and animation.
 *
 * @module @frontend/components/ToastContainer
 */

import React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Toast as ToastType } from '../context/ToastContext';

import { Toast } from './Toast';
import './ToastContainer.css';

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

/**
 * ToastContainer — Fixed positioned container for toast notifications.
 * Uses a portal to render at document.body level for proper stacking.
 */
export function ToastContainer({ toasts, onDismiss }: ToastContainerProps): JSX.Element | null {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || toasts.length === 0) {
    return null;
  }

  const container = (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );

  return createPortal(container, document.body);
}