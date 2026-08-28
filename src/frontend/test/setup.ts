import '@testing-library/jest-dom';
import { act } from 'react';

// React 18 act() compatibility for testing
// Ensures all state updates are wrapped in act() in test environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(globalThis as any).act = act;
