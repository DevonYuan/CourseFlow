import '@testing-library/jest-dom';
import { act } from 'react';
import { vi } from 'vitest';
// React 18 act() compatibility for testing
// Ensures all state updates are wrapped in act() in test environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
globalThis.act = act;
// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
    writable: true,
});
//# sourceMappingURL=setup.js.map