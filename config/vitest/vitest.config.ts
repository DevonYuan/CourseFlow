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
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/__tests__/**',
        'src/**/*.playwright.ts',
        'src/frontend/test/**',
        'src/backend/shared/types.ts',
        'src/backend/shared/ipc.ts',
        'src/backend/shared/index.ts',
        'src/backend/shared/types/**',
        'src/frontend/src/mocks/**',
      ],
      // Repo-wide floors plus per-glob targets for the Phase 3 modules:
      // backend data layer >80% lines, sub-task/note UI + ProgressBar >70%.
      thresholds: {
        lines: 50,
        statements: 50,
        branches: 70,
        functions: 65,
        'src/backend/main/db/repository.ts': {
          lines: 80,
          statements: 80,
          branches: 55,
          functions: 90,
        },
        'src/frontend/src/components/subtasks/**': { lines: 70 },
        'src/frontend/src/components/notes/**': { lines: 70 },
        'src/frontend/src/components/ui/ProgressBar.tsx': { lines: 90 },
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
