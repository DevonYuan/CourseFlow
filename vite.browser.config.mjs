import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: resolve(dirname, 'src/frontend'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(dirname, 'src/frontend/src'),
      '@shared': resolve(dirname, 'src/backend/shared'),
    },
  },
  server: { port: 5199 },
});
