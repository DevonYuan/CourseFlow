/**
 * Toast — Individual Toast Notification
 *
 * Displays a single toast with type-specific styling and dismiss button.
 * Supports keyboard dismiss (Escape) and auto-dismiss timer.
 *
 * @module @frontend/components/Toast
 */
import type { Toast as ToastType } from '../context/ToastContext';
import './Toast.css';
interface ToastProps {
    toast: ToastType;
    onDismiss: (id: string) => void;
}
/**
 * Individual toast notification with animation and accessibility.
 */
export declare function Toast({ toast, onDismiss }: ToastProps): JSX.Element;
export {};
//# sourceMappingURL=Toast.d.ts.map