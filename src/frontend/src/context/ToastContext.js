import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Toast Context — Global Toast Notification System
 *
 * Provides a simple toast notification system with success, error, info, and warning types.
 * Uses React Context for global access and a portal-based container for positioning.
 *
 * @module @frontend/context/ToastContext
 */
import { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer } from '../components/ToastContainer';
const ToastContext = createContext(null);
const DEFAULT_DURATION = 5000;
const MAX_VISIBLE_TOASTS = 3;
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
/**
 * ToastProvider — wraps the app and provides toast functionality.
 * Renders ToastContainer as a portal to document.body.
 */
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const addToast = useCallback((type, message, options) => {
        const id = generateId();
        const duration = options?.duration ?? DEFAULT_DURATION;
        const toast = { id, type, message, duration };
        setToasts((prev) => {
            const updated = [...prev, toast];
            // Keep only MAX_VISIBLE_TOASTS visible, queue the rest
            return updated.slice(-MAX_VISIBLE_TOASTS);
        });
        // Auto-dismiss after duration
        const timeoutId = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            options?.onDismiss?.();
        }, duration);
        // Store timeout ID for potential cleanup (not implemented for simplicity)
        // Could be extended to support canceling auto-dismiss
        return id;
    }, []);
    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    const success = useCallback((message, options) => addToast('success', message, options), [addToast]);
    const error = useCallback((message, options) => addToast('error', message, options), [addToast]);
    const info = useCallback((message, options) => addToast('info', message, options), [addToast]);
    const warning = useCallback((message, options) => addToast('warning', message, options), [addToast]);
    return (_jsxs(ToastContext.Provider, { value: { success, error, info, warning, dismiss }, children: [children, _jsx(ToastContainer, { toasts: toasts, onDismiss: dismiss })] }));
}
/**
 * Hook to access toast functions from any component.
 * Must be used within a ToastProvider.
 */
export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
//# sourceMappingURL=ToastContext.js.map