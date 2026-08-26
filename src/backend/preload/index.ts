import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // IPC methods will be exposed here in phase0-04-ipc
});

export type Api = typeof api;
