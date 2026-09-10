import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: projectRoot,
  plugins: [react({ jsxRuntime: 'automatic', jsxImportSource: 'react' })],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src/frontend/src'),
      '@shared': resolve(projectRoot, 'src/backend/shared'),
    },
  },
  test: {
    name: 'renderer',
    environment: 'jsdom',
    include: ['src/frontend/src/**/*.test.{ts,tsx}'],
    exclude: ['**/*.spec.ts', '**/integration/**'],
    setupFiles: ['src/frontend/test/setup.ts'],
    globals: true,
  },
});