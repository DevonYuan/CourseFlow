/**
 * IPC Handlers — Main Process
 *
 * Implements all channels defined in @backend/shared/ipc using the database repository.
 * Each handler returns IpcResult<T> — never throws across IPC boundary.
 *
 * @module @backend/main/ipc-handlers
 */
/**
 * Register all IPC handlers with ipcMain.
 * Call this during app initialization (after app.whenReady()).
 */
export declare function registerIpcHandlers(): void;
//# sourceMappingURL=ipc-handlers.d.ts.map