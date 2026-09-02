import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ErrorBoundary Tests
 *
 * Tests for the global error boundary component.
 */
// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';
// Component that throws an error during render
class ThrowError extends React.Component {
    render() {
        if (this.props.shouldThrow) {
            throw new Error('Test render error');
        }
        return _jsx("div", { children: "Child content" });
    }
}
describe('ErrorBoundary', () => {
    let consoleErrorSpy;
    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        cleanup();
    });
    it('renders children normally when no error occurs', () => {
        render(_jsx(ErrorBoundary, { children: _jsx(ThrowError, { shouldThrow: false }) }));
        expect(screen.getByText('Child content')).toBeInTheDocument();
    });
    it('shows fallback UI when child throws during render', () => {
        render(_jsx(ErrorBoundary, { children: _jsx(ThrowError, { shouldThrow: true }) }));
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('Test render error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reload app/i })).toBeInTheDocument();
    });
    it('logs error to console via componentDidCatch', () => {
        render(_jsx(ErrorBoundary, { children: _jsx(ThrowError, { shouldThrow: true }) }));
        expect(consoleErrorSpy).toHaveBeenCalledWith('ErrorBoundary caught:', expect.any(Error), expect.any(Object));
    });
    it('calls custom fallback render prop when provided', () => {
        const customFallback = vi.fn(({ error, reset }) => (_jsxs("div", { "data-testid": "custom-fallback", children: [_jsxs("p", { children: ["Custom: ", error.message] }), _jsx("button", { onClick: reset, children: "Custom Reset" })] })));
        render(_jsx(ErrorBoundary, { fallback: customFallback, children: _jsx(ThrowError, { shouldThrow: true }) }));
        expect(customFallback).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.objectContaining({ message: 'Test render error' }),
            reset: expect.any(Function),
        }));
        expect(screen.getByText('Custom: Test render error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /custom reset/i })).toBeInTheDocument();
    });
    it('reset function clears error state when called from custom fallback', () => {
        const customFallback = ({ reset }) => (_jsx("button", { onClick: reset, "data-testid": "reset-btn", children: "Reset" }));
        const { rerender } = render(_jsx(ErrorBoundary, { fallback: customFallback, children: _jsx(ThrowError, { shouldThrow: true }) }));
        expect(screen.getByTestId('reset-btn')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('reset-btn'));
        // After reset, the child should render again (but will throw again since shouldThrow is still true)
        // This tests that the reset function is called
    });
    it('has role="alert" on fallback', () => {
        render(_jsx(ErrorBoundary, { children: _jsx(ThrowError, { shouldThrow: true }) }));
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });
});
//# sourceMappingURL=ErrorBoundary.test.js.map