import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: projectRoot,
  test: {
    name: 'preload',
    environment: 'node',
    include: ['src/backend/preload/**/*.test.ts'],
    globals: true,
  },
});