import '@testing-library/jest-dom/vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';
import { act } from 'react';
import { expect } from 'vitest';
import { vi } from 'vitest';

// Make React available globally for JSX transform
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

// Extend vitest's expect with jest-dom matchers
expect.extend(matchers);

// React 18 act() compatibility for testing
// Ensures all state updates are wrapped in act() in test environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).act = act;

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  writable: true,
});

// Mock window.api for IPC communication
const createMockApi = () => {
  const mockUnsubscribe = vi.fn();

  return {
    db: {
      assignments: {
        list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        get: vi.fn().mockResolvedValue({ ok: true, data: null }),
        upsert: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        delete: vi.fn().mockResolvedValue({ ok: true }),
      },
      subtasks: {
        list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        upsert: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        delete: vi.fn().mockResolvedValue({ ok: true }),
        toggle: vi.fn().mockResolvedValue({ ok: true, data: {} }),
      },
      notes: {
        list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        upsert: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        delete: vi.fn().mockResolvedValue({ ok: true }),
      },
      pages: {
        list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        get: vi.fn().mockResolvedValue({ ok: true, data: null }),
        tree: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        create: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        update: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        delete: vi.fn().mockResolvedValue({ ok: true }),
        move: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        search: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      },
      priority: {
        list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        reorder: vi.fn().mockResolvedValue({ ok: true }),
        upsert: vi.fn().mockResolvedValue({ ok: true, data: {} }),
      },
      calendars: {
        list: vi.fn().mockResolvedValue({ ok: true, data: [] }),
        get: vi.fn().mockResolvedValue({ ok: true, data: null }),
        create: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        update: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        delete: vi.fn().mockResolvedValue({ ok: true }),
        reorder: vi.fn().mockResolvedValue({ ok: true }),
        setEnabled: vi.fn().mockResolvedValue({ ok: true, data: {} }),
      },
    },
    ical: {
      fetch: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      import: vi.fn().mockResolvedValue({ ok: true, data: { imported: 0, updated: 0, skipped: 0 } }),
    },
    settings: {
      get: vi.fn().mockResolvedValue({ ok: true, data: {} }),
      set: vi.fn().mockResolvedValue({ ok: true, data: {} }),
      reset: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    },
    app: {
      version: vi.fn().mockResolvedValue({ ok: true, data: '0.1.0' }),
    },
    onDbChanged: vi.fn().mockReturnValue(mockUnsubscribe),
    onSettingsChanged: vi.fn().mockReturnValue(mockUnsubscribe),
    onIcalProgress: vi.fn().mockReturnValue(mockUnsubscribe),
  };
};

// Set up window.api mock at module load (runs once before all tests)
Object.defineProperty(window, 'api', {
  value: createMockApi(),
  writable: true,
  configurable: true,
});

// Note: We don't use beforeEach here because test file beforeEach runs first.
// Individual tests should use vi.resetAllMocks() or manually reset mocks as needed.
