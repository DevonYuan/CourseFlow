import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'preload',
    environment: 'node',
    include: ['src/backend/preload/**/*.test.ts'],
    globals: true,
  },
});