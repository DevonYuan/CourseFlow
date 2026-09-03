import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..');

export default defineConfig({
  root: projectRoot,
  test: {
    name: 'shared',
    environment: 'node',
    include: ['src/backend/shared/**/*.test.ts'],
    globals: true,
  },
});