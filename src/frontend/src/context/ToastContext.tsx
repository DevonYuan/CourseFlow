/**
 * Toast Context — Global Toast Notification System
 *
 * Provides a simple toast notification system with success, error, info, and warning types.
 * Uses React Context for global access and a portal-based container for positioning.
 *
 * @module @frontend/context/ToastContext
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

import { ToastContainer } from '../components/ToastContainer';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
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

  const addToast = useCallback((type: ToastType, message: string, duration?: number): string => {
    const id = generateId();
    const toast: Toast = { id, type, message, duration: duration ?? DEFAULT_DURATION };

    setToasts((prev) => {
      const updated = [...prev, toast];
      // Keep only MAX_VISIBLE_TOASTS visible, queue the rest
      return updated.slice(-MAX_VISIBLE_TOASTS);
    });

    // Auto-dismiss after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration);

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => addToast('success', message, duration), [addToast]);
  const error = useCallback((message: string, duration?: number) => addToast('error', message, duration), [addToast]);
  const info = useCallback((message: string, duration?: number) => addToast('info', message, duration), [addToast]);
  const warning = useCallback((message: string, duration?: number) => addToast('warning', message, duration), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, success, error, info, warning, dismiss }}>
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