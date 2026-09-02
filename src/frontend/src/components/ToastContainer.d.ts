/**
 * ToastContainer — Portal-based Toast Container
 *
 * Renders toasts in a fixed position container (top-right).
 * Handles stacking and animation.
 *
 * @module @frontend/components/ToastContainer
 */
import type { Toast as ToastType } from '../context/ToastContext';
import './ToastContainer.css';
interface ToastContainerProps {
    toasts: ToastType[];
    onDismiss: (id: string) => void;
}
/**
 * ToastContainer — Fixed positioned container for toast notifications.
 * Uses a portal to render at document.body level for proper stacking.
 */
export declare function ToastContainer({ toasts, onDismiss }: ToastContainerProps): JSX.Element | null;
export {};
//# sourceMappingURL=ToastContainer.d.ts.map