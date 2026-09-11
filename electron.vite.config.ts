import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';

// Plugin to copy migration files
function copyMigrationsPlugin() {
  return {
    name: 'copy-migrations',
    writeBundle() {
      const srcDir = resolve(__dirname, 'src/backend/main/db/migrations');
      const destDir = resolve(__dirname, 'dist/backend/main/migrations');

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      const files = readdirSync(srcDir);
      for (const file of files) {
        const srcFile = resolve(srcDir, file);
        const destFile = resolve(destDir, file);
        if (statSync(srcFile).isFile()) {
          copyFileSync(srcFile, destFile);
        }
      }
    },
  };
}

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/backend/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/backend/main/index.ts'),
        },
        external: ['sql.js', 'better-sqlite3'],
      },
    },
    plugins: [copyMigrationsPlugin()],
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
      // Absolute path — resolves regardless of electron-vite's root handling
      outDir: resolve(__dirname, 'dist/frontend'),
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
