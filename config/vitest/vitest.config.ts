import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src/frontend/src'),
      '@shared': resolve(projectRoot, 'src/backend/shared'),
    },
  },
  test: {
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      thresholds: { lines: 0, branches: 0, functions: 0, statements: 0 },
    },
    projects: [
      {
        extends: resolve(__dirname, './vitest.main.ts'),
        test: { root: projectRoot },
      },
      {
        extends: resolve(__dirname, './vitest.preload.ts'),
        test: { root: projectRoot },
      },
      {
        extends: resolve(__dirname, './vitest.shared.ts'),
        test: { root: projectRoot },
      },
      {
        extends: resolve(__dirname, './vitest.renderer.ts'),
        test: { root: projectRoot },
      },
    ],
  },
});
