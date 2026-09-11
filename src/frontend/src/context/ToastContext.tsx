/**
 * Toast Context — Global Toast Notification System
 *
 * Provides a simple toast notification system with success, error, info, and warning types.
 * Uses React Context for global access and a portal-based container for positioning.
 *
 * @module @frontend/context/ToastContext
 */

import React from 'react';
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

import { ToastContainer } from '../components/ToastContainer';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  /** Optional action button for the toast (e.g., Retry) */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastOptions {
  duration?: number; // ms, default 5000
  onDismiss?: () => void;
  /** Optional action button for the toast (e.g., Retry) */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE_TOASTS = 3;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * ToastProvider — wraps the app and provides toast functionality.
 * Renders ToastContainer as a portal to document.body.
 */
export function ToastProvider({ children }: ToastProviderProps): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions): string => {
      const id = generateId();
      const duration = options?.duration ?? DEFAULT_DURATION;
      const toast: Toast = { id, type, message, duration, action: options?.action };

      setToasts((prev) => {
        const updated = [...prev, toast];
        // Keep only MAX_VISIBLE_TOASTS visible, queue the rest
        return updated.slice(-MAX_VISIBLE_TOASTS);
      });

      // Auto-dismiss after duration
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        options?.onDismiss?.();
      }, duration);

      return id;
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, options?: ToastOptions) => addToast('success', message, options),
    [addToast],
  );
  const error = useCallback(
    (message: string, options?: ToastOptions) => addToast('error', message, options),
    [addToast],
  );
  const info = useCallback(
    (message: string, options?: ToastOptions) => addToast('info', message, options),
    [addToast],
  );
  const warning = useCallback(
    (message: string, options?: ToastOptions) => addToast('warning', message, options),
    [addToast],
  );

  return (
    <ToastContext.Provider value={{ success, error, info, warning, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast functions from any component.
 * Must be used within a ToastProvider.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
