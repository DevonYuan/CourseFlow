import { join } from 'node:path';

import { app, BrowserWindow } from 'electron';

import { initializeDatabase, closeDatabase } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { repo } from './db/repository.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { getScheduler, startScheduler, stopScheduler } from './scheduler.js';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'CourseFlow',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env['NODE_ENV'] === 'development') {
    void mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadFile(join(import.meta.dirname, '../../frontend/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

void app.whenReady().then(async () => {
  // Initialize database and run migrations (includes v6 seeding)
  const db = await initializeDatabase();
  await migrate(db);

  // Register all IPC handlers before creating windows
  registerIpcHandlers();

  // Load settings on startup
  const settings = await repo.getAllSettings();

  void createWindow();

  // Initialize scheduler with main window reference
  getScheduler(mainWindow);

  // Apply theme to main window and emit settings:changed event
  if (mainWindow) {
    // Send theme to renderer via webContents (will be received by preload)
    mainWindow.webContents.send('settings:changed', settings);
  }

  // Start auto-fetch scheduler
  startScheduler(settings);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  stopScheduler();
  closeDatabase();
});
