import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ErrorBoundary — Global Error Boundary Component
 *
 * Catches render errors in the component tree and displays a fallback UI.
 * Does not catch errors in: event handlers, async code, SSR, or itself.
 *
 * @module @frontend/components/ErrorBoundary
 */
import { Component } from 'react';
/**
 * ErrorBoundary class component that catches render errors.
 * Logs errors to console and provides a reload fallback UI.
 */
export class ErrorBoundary extends Component {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
    }
    reset = () => {
        this.setState({ hasError: false, error: null });
    };
    render() {
        if (this.state.hasError) {
            // If a custom fallback is provided, use it
            if (this.props.fallback && this.state.error) {
                return this.props.fallback({ error: this.state.error, reset: this.reset });
            }
            // Default fallback UI
            return (_jsxs("div", { className: "error-boundary", role: "alert", children: [_jsx("h2", { children: "Something went wrong" }), _jsx("p", { children: this.state.error?.message ?? 'An unexpected error occurred' }), _jsx("button", { onClick: () => window.location.reload(), children: "Reload App" })] }));
        }
        return this.props.children;
    }
}
//# sourceMappingURL=ErrorBoundary.js.map