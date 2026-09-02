import { jsx as _jsx } from "react/jsx-runtime";
/**
 * ToastContainer — Portal-based Toast Container
 *
 * Renders toasts in a fixed position container (top-right).
 * Handles stacking and animation.
 *
 * @module @frontend/components/ToastContainer
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast } from './Toast';
import './ToastContainer.css';
/**
 * ToastContainer — Fixed positioned container for toast notifications.
 * Uses a portal to render at document.body level for proper stacking.
 */
export function ToastContainer({ toasts, onDismiss }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);
    if (!mounted || toasts.length === 0) {
        return null;
    }
    const container = (_jsx("div", { className: "toast-container", role: "region", "aria-label": "Notifications", "aria-live": "polite", children: toasts.map((toast) => (_jsx(Toast, { toast: toast, onDismiss: onDismiss }, toast.id))) }));
    return createPortal(container, document.body);
}
//# sourceMappingURL=ToastContainer.js.map