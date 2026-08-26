import { contextBridge, ipcRenderer } from 'electron';

import type { IpcChannels, IpcEvents, IpcResult } from '../shared/ipc.js';
import type { Settings } from '../shared/types.js';

/**
 * Typed wrapper for ipcRenderer.invoke that returns IpcResult<T>.
 */
function invoke<C extends keyof IpcChannels>(
  channel: C,
  request: IpcChannels[C]['request'],
): Promise<IpcResult<IpcChannels[C]['response']>> {
  return ipcRenderer.invoke(channel, request) as Promise<IpcResult<IpcChannels[C]['response']>>;
}

/**
 * Typed wrapper for ipcRenderer.on for one-way events.
 */
function on<E extends keyof IpcEvents>(
  channel: E,
  callback: (payload: IpcEvents[E]) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: IpcEvents[E]) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
}

/**
 * ContextBridge API exposed to renderer as `window.api`.
 * Fully typed — no `any`, no raw ipcRenderer exposure.
 */
const api = {
  db: {
    assignments: {
      list: () => invoke('db:assignments:list', undefined),
      get: (id: string) => invoke('db:assignments:get', id),
      upsert: (input: IpcChannels['db:assignments:upsert']['request']) =>
        invoke('db:assignments:upsert', input),
      delete: (id: string) => invoke('db:assignments:delete', id),
    },
    subtasks: {
      list: (assignmentId: string) => invoke('db:subtasks:list', assignmentId),
      upsert: (input: IpcChannels['db:subtasks:upsert']['request']) =>
        invoke('db:subtasks:upsert', input),
      delete: (id: string) => invoke('db:subtasks:delete', id),
      toggle: (input: IpcChannels['db:subtasks:toggle']['request']) =>
        invoke('db:subtasks:toggle', input),
    },
    notes: {
      list: (assignmentId: string) => invoke('db:notes:list', assignmentId),
      upsert: (input: IpcChannels['db:notes:upsert']['request']) =>
        invoke('db:notes:upsert', input),
      delete: (id: string) => invoke('db:notes:delete', id),
    },
    priority: {
      list: () => invoke('db:priority:list', undefined),
      reorder: (ids: string[]) => invoke('db:priority:reorder', ids),
      upsert: (input: IpcChannels['db:priority:upsert']['request']) =>
        invoke('db:priority:upsert', input),
    },
  },
  ical: {
    fetch: (url: string) => invoke('ical:fetch', { url }),
    import: (input: IpcChannels['ical:import']['request']) => invoke('ical:import', input),
  },
  settings: {
    get: () => invoke('settings:get', undefined),
    set: (partial: Partial<Settings>) => invoke('settings:set', partial),
    reset: () => invoke('settings:reset', undefined),
  },
  app: {
    version: () => invoke('app:version', undefined),
  },
  // Event subscriptions — return cleanup function
  onDbChanged: (callback: (payload: IpcEvents['db:changed']) => void) => on('db:changed', callback),
  onIcalProgress: (callback: (payload: IpcEvents['ical:progress']) => void) =>
    on('ical:progress', callback),
  onSettingsChanged: (callback: (payload: IpcEvents['settings:changed']) => void) =>
    on('settings:changed', callback),
} as const;

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
