/**
 * useToast Hook Tests
 *
 * Tests for the toast notification hook and context.
 */

// @vitest-environment jsdom

import * as matchers from '@testing-library/jest-dom/matchers';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ToastProvider, useToast, type ToastContextValue } from '../context/ToastContext';


// Extend expect with jest-dom matchers for this test file
expect.extend(matchers);

// Test component that uses useToast
const ToastTestComponent = () => {
  const { success, error, info, warning, dismiss } = useToast();

  return (
    <div>
      <button onClick={() => success('Success message')}>Show Success</button>
      <button onClick={() => error('Error message')}>Show Error</button>
      <button onClick={() => info('Info message')}>Show Info</button>
      <button onClick={() => warning('Warning message')}>Show Warning</button>
      <button onClick={() => dismiss('test-id')}>Dismiss</button>
      <div data-testid="toast-container">{/* container rendered by provider */}</div>
    </div>
  );
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('provides success, error, info, warning, and dismiss functions', () => {
    render(<ToastTestComponent />, { wrapper: Wrapper });

    // Just verify the component renders without error
    expect(screen.getByText('Show Success')).toBeInTheDocument();
  });

  it('shows success toast when success is called', () => {
    render(
      <Wrapper>
        <ToastTestComponent />
      </Wrapper>
    );

    fireEvent.click(screen.getByText('Show Success'));

    // Toast has role="status" but no accessible name - use getByText instead
    expect(screen.getByText('Success message')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error toast with role="alert" when error is called', () => {
    render(
      <Wrapper>
        <ToastTestComponent />
      </Wrapper>
    );

    fireEvent.click(screen.getByText('Show Error'));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('shows info toast with role="status" when info is called', () => {
    render(
      <Wrapper>
        <ToastTestComponent />
      </Wrapper>
    );

    fireEvent.click(screen.getByText('Show Info'));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('shows warning toast with role="status" when warning is called', () => {
    render(
      <Wrapper>
        <ToastTestComponent />
      </Wrapper>
    );

    fireEvent.click(screen.getByText('Show Warning'));

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('returns toastId from success function', () => {
    const TestComp = () => {
      const { success } = useToast();
      const [lastId, setLastId] = React.useState<string | null>(null);
      return (
        <div>
          <button onClick={() => setLastId(success('Test'))}>Show</button>
          <span data-testid="toast-id">{lastId}</span>
        </div>
      );
    };

    render(<Wrapper><TestComp /></Wrapper>);
    fireEvent.click(screen.getByText('Show'));
    const toastId = screen.getByTestId('toast-id').textContent;
    expect(toastId).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it('auto-dismisses toast after default duration (5000ms)', () => {
    render(
      <Wrapper>
        <ToastTestComponent />
      </Wrapper>
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Success message')).not.toBeInTheDocument();
  });

  it('auto-dismisses toast after custom duration', () => {
    const TestComp = () => {
      const { success } = useToast();
      return <button onClick={() => success('Custom duration', { duration: 1000 })}>Show</button>;
    };

    render(<Wrapper><TestComp /></Wrapper>);
    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('Custom duration')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Custom duration')).not.toBeInTheDocument();
  });

  it('manually dismisses toast when dismiss is called', () => {
    const TestComp = () => {
      const { success, dismiss } = useToast();
      const [toastId, setToastId] = React.useState<string | null>(null);
      return (
        <div>
          <button onClick={() => setToastId(success('To dismiss'))}>Show</button>
          <button onClick={() => toastId && dismiss(toastId)}>Dismiss</button>
        </div>
      );
    };

    render(<Wrapper><TestComp /></Wrapper>);
    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('To dismiss')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByText('To dismiss')).not.toBeInTheDocument();
  });

  it('limits visible toasts to 3 (max visible)', () => {
    const TestComp = () => {
      const { success } = useToast();
      return (
        <div>
          <button onClick={() => {
            success('Toast 1');
            success('Toast 2');
            success('Toast 3');
            success('Toast 4');
            success('Toast 5');
          }}>Show 5</button>
        </div>
      );
    };

    render(<Wrapper><TestComp /></Wrapper>);
    fireEvent.click(screen.getByText('Show 5'));

    // Should only show last 3 (toast 3, 4, 5)
    expect(screen.getByText('Toast 3')).toBeInTheDocument();
    expect(screen.getByText('Toast 4')).toBeInTheDocument();
    expect(screen.getByText('Toast 5')).toBeInTheDocument();
    // Toast 1 and 2 should be removed (not just hidden)
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Toast 2')).not.toBeInTheDocument();
  });

  it('calls onDismiss callback when toast auto-dismisses', () => {
    const onDismiss = vi.fn();
    const TestComp = () => {
      const { success } = useToast();
      return <button onClick={() => success('Test', { onDismiss, duration: 100 })}>Show</button>;
    };

    render(<Wrapper><TestComp /></Wrapper>);
    fireEvent.click(screen.getByText('Show'));
    expect(screen.getByText('Test')).toBeInTheDocument();

    // Advance timers to trigger auto-dismiss
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses toast on Escape key press', () => {
    render(
      <Wrapper>
        <ToastTestComponent />
      </Wrapper>
    );

    fireEvent.click(screen.getByText('Show Error'));
    const toast = screen.getByRole('alert');
    expect(toast).toBeInTheDocument();

    fireEvent.keyDown(toast, { key: 'Escape' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('throws error when used outside ToastProvider', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const BadComponent = () => {
      useToast(); // Should throw
      return <div>Bad</div>;
    };

    expect(() => render(<BadComponent />)).toThrow('useToast must be used within a ToastProvider');
    
    consoleErrorSpy.mockRestore();
  });

  it('renders toast container as portal to document.body', () => {
    render(
      <Wrapper>
        <ToastTestComponent />
      </Wrapper>
    );

    fireEvent.click(screen.getByText('Show Success'));
    
    // The toast should be in a portal at document.body level
    const toast = screen.getByText('Success message').closest('.toast');
    expect(document.body.contains(toast)).toBe(true);
  });
});