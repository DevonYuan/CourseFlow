/**
 * ErrorBoundary — Global Error Boundary Component
 *
 * Catches render errors in the component tree and displays a fallback UI.
 * Does not catch errors in: event handlers, async code, SSR, or itself.
 *
 * @module @frontend/components/ErrorBoundary
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}
interface ErrorBoundaryProps {
    children: ReactNode;
    /** Optional fallback render prop */
    fallback?: (error: Error, reset: () => void) => ReactNode;
}
/**
 * ErrorBoundary class component that catches render errors.
 * Logs errors to console and provides a reload fallback UI.
 */
export declare class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState;
    static getDerivedStateFromError(error: Error): ErrorBoundaryState;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    private reset;
    render(): ReactNode;
}
export {};
//# sourceMappingURL=ErrorBoundary.d.ts.map