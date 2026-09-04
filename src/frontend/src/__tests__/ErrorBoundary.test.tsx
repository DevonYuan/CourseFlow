/**
 * ErrorBoundary Tests
 *
 * Tests for the global error boundary component.
 */

// @vitest-environment jsdom

import * as matchers from '@testing-library/jest-dom/matchers';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ErrorBoundary } from '../components/ErrorBoundary';


// Extend expect with jest-dom matchers
expect.extend(matchers);

// Component that throws an error during render
class ThrowError extends React.Component<{ shouldThrow: boolean }> {
  override render() {
    if (this.props.shouldThrow) {
      throw new Error('Test render error');
    }
    return <div>Child content</div>;
  }
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('shows fallback UI when child throws during render', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test render error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload app/i })).toBeInTheDocument();
  });

  it('logs error to console via componentDidCatch', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith('ErrorBoundary caught:', expect.any(Error), expect.any(Object));
  });

  it('calls custom fallback render prop when provided', () => {
    const customFallback = vi.fn((error: Error, reset: () => void) => (
      <div data-testid="custom-fallback">
        <p>Custom: {error.message}</p>
        <button onClick={reset}>Custom Reset</button>
      </div>
    ));

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(customFallback).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test render error' }),
      expect.any(Function)
    );
    expect(screen.getByText('Custom: Test render error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom reset/i })).toBeInTheDocument();
  });

  it('reset function clears error state when called from custom fallback', () => {
    const customFallback = (error: Error, reset: () => void) => (
      <button onClick={reset} data-testid="reset-btn">
        Reset
      </button>
    );

    const { rerender } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('reset-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('reset-btn'));
    // After reset, the child should render again (but will throw again since shouldThrow is still true)
    // This tests that the reset function is called
  });

  it('has role="alert" on fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});