import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  './vitest.main.ts',
  './vitest.preload.ts',
  './vitest.shared.ts',
  './vitest.renderer.ts',
]);