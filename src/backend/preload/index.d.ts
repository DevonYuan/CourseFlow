import type { IpcChannels, IpcEvents, IpcResult } from '../shared/ipc.js';
import type { Settings } from '../shared/types.js';
/**
 * ContextBridge API exposed to renderer as `window.api`.
 * Fully typed — no `any`, no raw ipcRenderer exposure.
 * All channels match src/backend/shared/ipc.ts contracts exactly.
 */
declare const api: {
    readonly db: {
        readonly assignments: {
            readonly list: () => Promise<IpcResult<import("../shared/types.js").Assignment[]>>;
            readonly get: (id: string) => Promise<IpcResult<import("../shared/types.js").Assignment | null>>;
            readonly upsert: (input: IpcChannels["db:assignments:upsert"]["request"]) => Promise<IpcResult<import("../shared/types.js").Assignment>>;
            readonly delete: (id: string) => Promise<IpcResult<void>>;
        };
        readonly subtasks: {
            readonly list: (assignmentId: string) => Promise<IpcResult<import("../shared/types.js").SubTask[]>>;
            readonly upsert: (input: IpcChannels["db:subtasks:upsert"]["request"]) => Promise<IpcResult<import("../shared/types.js").SubTask>>;
            readonly delete: (id: string) => Promise<IpcResult<void>>;
            readonly toggle: (input: IpcChannels["db:subtasks:toggle"]["request"]) => Promise<IpcResult<import("../shared/types.js").SubTask>>;
        };
        readonly notes: {
            readonly list: (assignmentId: string) => Promise<IpcResult<import("../shared/types.js").Note[]>>;
            readonly upsert: (input: IpcChannels["db:notes:upsert"]["request"]) => Promise<IpcResult<import("../shared/types.js").Note>>;
            readonly delete: (id: string) => Promise<IpcResult<void>>;
        };
        readonly priority: {
            readonly list: () => Promise<IpcResult<import("../shared/types.js").PriorityOrder[]>>;
            readonly reorder: (ids: string[]) => Promise<IpcResult<void>>;
            readonly upsert: (input: IpcChannels["db:priority:upsert"]["request"]) => Promise<IpcResult<import("../shared/types.js").PriorityOrder>>;
        };
    };
    readonly ical: {
        readonly fetch: (url: string) => Promise<IpcResult<import("../shared/types.js").ICalEvent[]>>;
        readonly import: (input: IpcChannels["ical:import"]["request"]) => Promise<IpcResult<{
            imported: number;
            updated: number;
            skipped: number;
        }>>;
    };
    readonly settings: {
        readonly get: () => Promise<IpcResult<Settings>>;
        readonly set: (partial: Partial<Settings>) => Promise<IpcResult<Settings>>;
        readonly reset: () => Promise<IpcResult<Settings>>;
    };
    readonly app: {
        readonly version: () => Promise<IpcResult<string>>;
    };
    readonly onDbChanged: (callback: (payload: IpcEvents["db:changed"]) => void) => () => void;
    readonly onIcalProgress: (callback: (payload: IpcEvents["ical:progress"]) => void) => () => void;
    readonly onSettingsChanged: (callback: (payload: IpcEvents["settings:changed"]) => void) => () => void;
};
export type Api = typeof api;
export {};
//# sourceMappingURL=index.d.ts.map