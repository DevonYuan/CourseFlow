import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { act } from 'react';
import { vi } from 'vitest';

// Extend vitest's expect with jest-dom matchers
expect.extend(matchers);

// React 18 act() compatibility for testing
// Ensures all state updates are wrapped in act() in test environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
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
