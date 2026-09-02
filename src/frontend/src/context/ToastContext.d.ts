/**
 * Toast Context — Global Toast Notification System
 *
 * Provides a simple toast notification system with success, error, info, and warning types.
 * Uses React Context for global access and a portal-based container for positioning.
 *
 * @module @frontend/context/ToastContext
 */
import { type ReactNode } from 'react';
export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}
export interface ToastOptions {
    duration?: number;
    onDismiss?: () => void;
}
interface ToastContextValue {
    success: (message: string, options?: ToastOptions) => string;
    error: (message: string, options?: ToastOptions) => string;
    info: (message: string, options?: ToastOptions) => string;
    warning: (message: string, options?: ToastOptions) => string;
    dismiss: (id: string) => void;
}
interface ToastProviderProps {
    children: ReactNode;
}
/**
 * ToastProvider — wraps the app and provides toast functionality.
 * Renders ToastContainer as a portal to document.body.
 */
export declare function ToastProvider({ children }: ToastProviderProps): JSX.Element;
/**
 * Hook to access toast functions from any component.
 * Must be used within a ToastProvider.
 */
export declare function useToast(): ToastContextValue;
export {};
//# sourceMappingURL=ToastContext.d.ts.map