import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '../..');

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
      reporter: ['text', 'html', 'lcov'],
      // Repo-wide floors that prevent coverage regressions. The Phase 3 test
      // suites additionally target >80% lines on the sub-task/note repository
      // code and >70% on the sub-task/note React components.
      thresholds: {
        lines: 40,
        statements: 40,
        branches: 65,
        functions: 55,
      },
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
