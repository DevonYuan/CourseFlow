import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/frontend/src'),
      '@shared': resolve(__dirname, 'src/backend/shared'),
    },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/backend/main/**/*.test.ts'],
          globals: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'preload',
          environment: 'node',
          include: ['src/backend/preload/**/*.test.ts'],
          globals: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'shared',
          environment: 'node',
          include: ['src/backend/shared/**/*.test.ts'],
          globals: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/frontend/**/*.test.{ts,tsx}'],
          setupFiles: ['src/frontend/test/setup.ts'],
          globals: true,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 0, branches: 0, functions: 0, statements: 0 },
    },
  },
});
