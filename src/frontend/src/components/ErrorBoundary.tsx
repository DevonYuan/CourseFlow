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
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  private reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback && this.state.error) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }

      // Default fallback UI
      return (
        <div className="error-boundary" role="alert">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message ?? 'An unexpected error occurred'}</p>
          <button onClick={() => window.location.reload()}>Reload App</button>
        </div>
      );
    }

    return this.props.children;
  }
}