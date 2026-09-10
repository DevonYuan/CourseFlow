import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '../..');

export default defineConfig({
  root: projectRoot,
  test: {
    name: 'main',
    environment: 'node',
    include: ['src/backend/main/**/*.test.ts'],
    globals: true,
  },
});