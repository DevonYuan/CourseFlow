import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'main',
    environment: 'node',
    include: ['src/backend/main/**/*.test.ts'],
    globals: true,
  },
});