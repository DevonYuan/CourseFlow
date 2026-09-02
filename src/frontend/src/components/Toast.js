import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Toast — Individual Toast Notification
 *
 * Displays a single toast with type-specific styling and dismiss button.
 * Supports keyboard dismiss (Escape) and auto-dismiss timer.
 *
 * @module @frontend/components/Toast
 */
import { useEffect, useRef } from 'react';
import './Toast.css';
const typeIcons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
};
const typeLabels = {
    success: 'Success',
    error: 'Error',
    info: 'Information',
    warning: 'Warning',
};
/**
 * Individual toast notification with animation and accessibility.
 */
export function Toast({ toast, onDismiss }) {
    const toastRef = useRef(null);
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
        const handleKeyDown = (event) => {
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
    return (_jsxs("div", { ref: toastRef, className: `toast toast--${toast.type}`, role: role, "aria-live": ariaLive, tabIndex: 0, onClick: handleClick, onKeyDown: handleClick, children: [_jsx("div", { className: "toast__icon", "aria-hidden": "true", children: typeIcons[toast.type] }), _jsxs("div", { className: "toast__content", children: [_jsx("span", { className: "toast__type", "aria-hidden": "true", children: typeLabels[toast.type] }), _jsx("p", { className: "toast__message", children: toast.message })] }), _jsx("button", { className: "toast__dismiss", onClick: (e) => {
                    e.stopPropagation();
                    onDismiss(toast.id);
                }, "aria-label": `Dismiss ${typeLabels[toast.type].toLowerCase()} toast`, children: _jsxs("svg", { viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }) })] }));
}
//# sourceMappingURL=Toast.js.map