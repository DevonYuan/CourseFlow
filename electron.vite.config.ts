import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/backend/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/backend/main/index.ts'),
        },
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist/backend/preload',
      lib: {
        entry: resolve(__dirname, 'src/backend/preload/index.ts'),
        formats: ['cjs'],
        fileName: 'index',
      },
    },
  },
  renderer: {
    root: 'src/frontend',
    build: {
      outDir: '../../dist/frontend',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/frontend/index.html'),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/frontend/src'),
        '@shared': resolve(__dirname, 'src/backend/shared'),
      },
    },
  },
});
