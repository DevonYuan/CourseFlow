import { contextBridge, ipcRenderer } from 'electron';
/**
 * Typed wrapper for ipcRenderer.invoke that returns IpcResult<T>.
 */
function invoke(channel, request) {
    return ipcRenderer.invoke(channel, request);
}
/**
 * Typed wrapper for ipcRenderer.on for one-way events.
 */
function on(channel, callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
}
/**
 * ContextBridge API exposed to renderer as `window.api`.
 * Fully typed — no `any`, no raw ipcRenderer exposure.
 * All channels match src/backend/shared/ipc.ts contracts exactly.
 */
const api = {
    db: {
        assignments: {
            list: () => invoke('db:assignments:list', undefined),
            get: (id) => invoke('db:assignments:get', id),
            upsert: (input) => invoke('db:assignments:upsert', input),
            delete: (id) => invoke('db:assignments:delete', id),
        },
        subtasks: {
            list: (assignmentId) => invoke('db:subtasks:list', assignmentId),
            upsert: (input) => invoke('db:subtasks:upsert', input),
            delete: (id) => invoke('db:subtasks:delete', id),
            toggle: (input) => invoke('db:subtasks:toggle', input),
        },
        notes: {
            list: (assignmentId) => invoke('db:notes:list', assignmentId),
            upsert: (input) => invoke('db:notes:upsert', input),
            delete: (id) => invoke('db:notes:delete', id),
        },
        priority: {
            list: () => invoke('db:priority:list', undefined),
            reorder: (ids) => invoke('db:priority:reorder', ids),
            upsert: (input) => invoke('db:priority:upsert', input),
        },
    },
    ical: {
        fetch: (url) => invoke('ical:fetch', { url }),
        import: (input) => invoke('ical:import', input),
    },
    settings: {
        get: () => invoke('settings:get', undefined),
        set: (partial) => invoke('settings:set', partial),
        reset: () => invoke('settings:reset', undefined),
    },
    app: {
        version: () => invoke('app:version', undefined),
    },
    // Event subscriptions — return cleanup function
    onDbChanged: (callback) => on('db:changed', callback),
    onIcalProgress: (callback) => on('ical:progress', callback),
    onSettingsChanged: (callback) => on('settings:changed', callback),
};
contextBridge.exposeInMainWorld('api', api);
//# sourceMappingURL=index.js.map