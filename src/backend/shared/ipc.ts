/**
 * IPC Channel & Event Type Definitions
 *
 * Single source of truth for all inter-process communication.
 * Imported by Main, Preload, and Renderer (via project references).
 *
 * @module @backend/shared/ipc
 */

import type {
  Assignment,
  AssignmentInput,
  SubTask,
  SubTaskInput,
  Note,
  NoteInput,
  PriorityOrder,
  PriorityOrderInput,
  Settings,
  ICalEvent,
} from './types.js';

/**
 * Unified response wrapper for all IPC request/response channels.
 * Handlers MUST return this type — never throw across IPC boundary.
 */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

/**
 * Standard error codes for programmatic error handling.
 */
export const IpcErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type IpcErrorCode = (typeof IpcErrorCode)[keyof typeof IpcErrorCode];

/**
 * Request/Response channel definitions.
 * Pattern: "<namespace>:<entity>:<action>"
 *
 * Usage in Main:
 *   ipcMain.handle('db:assignments:list', handler)
 *
 * Usage in Preload:
 *   list: () => ipcRenderer.invoke('db:assignments:list')
 *
 * Usage in Renderer:
 *   const result = await window.api.db.assignments.list()
 */
export interface IpcChannels {
  // ── Database: Assignments ──────────────────────────────────────────────
  'db:assignments:list': {
    request: void;
    response: Assignment[];
  };
  'db:assignments:get': {
    request: string; // id
    response: Assignment | null;
  };
  'db:assignments:upsert': {
    request: AssignmentInput;
    response: Assignment;
  };
  'db:assignments:delete': {
    request: string; // id
    response: void;
  };

  // ── Database: SubTasks ─────────────────────────────────────────────────
  'db:subtasks:list': {
    request: string; // assignmentId
    response: SubTask[];
  };
  'db:subtasks:upsert': {
    request: SubTaskInput;
    response: SubTask;
  };
  'db:subtasks:delete': {
    request: string; // id
    response: void;
  };
  'db:subtasks:toggle': {
    request: { id: string; completed: boolean };
    response: SubTask;
  };

  // ── Database: Notes ────────────────────────────────────────────────────
  'db:notes:list': {
    request: string; // assignmentId
    response: Note[];
  };
  'db:notes:upsert': {
    request: NoteInput;
    response: Note;
  };
  'db:notes:delete': {
    request: string; // id
    response: void;
  };

  // ── Database: Priority Order ───────────────────────────────────────────
  'db:priority:list': {
    request: void;
    response: PriorityOrder[];
  };
  'db:priority:reorder': {
    request: string[]; // ordered assignment IDs
    response: void;
  };
  'db:priority:upsert': {
    request: PriorityOrderInput;
    response: PriorityOrder;
  };

  // ── iCal Integration ───────────────────────────────────────────────────
  'ical:fetch': {
    request: { url: string };
    response: ICalEvent[];
  };
  'ical:import': {
    request: { events: ICalEvent[]; sourceUrl: string };
    response: { imported: number; updated: number; skipped: number };
  };

  // ── Settings ───────────────────────────────────────────────────────────
  'settings:get': {
    request: void;
    response: Settings;
  };
  'settings:set': {
    request: Partial<Settings>;
    response: Settings;
  };
  'settings:reset': {
    request: void;
    response: Settings;
  };

  // ── App ────────────────────────────────────────────────────────────────
  'app:version': {
    request: void;
    response: string;
  };
}

/**
 * One-way event channels (Main → Renderer notifications).
 * Pattern: "<namespace>:<event>"
 *
 * Usage in Main:
 *   mainWindow.webContents.send('db:changed', payload)
 *
 * Usage in Preload:
 *   onDbChanged: (cb) => ipcRenderer.on('db:changed', (_e, payload) => cb(payload))
 *
 * Usage in Renderer:
 *   window.api.onDbChanged(({ table, action, id }) => { ... })
 */
export interface IpcEvents {
  'db:changed': {
    table: string;
    action: 'insert' | 'update' | 'delete' | 'upsert' | 'reorder';
    id: string;
  };
  'ical:progress': {
    stage: 'fetch' | 'parse' | 'store';
    progress: number;
    message?: string;
  };
  'settings:changed': Settings;
}

/**
 * Type helper: extract request type from channel.
 */
export type IpcRequest<C extends keyof IpcChannels> = IpcChannels[C]['request'];

/**
 * Type helper: extract response type from channel.
 */
export type IpcResponse<C extends keyof IpcChannels> = IpcChannels[C]['response'];

/**
 * Type helper: extract event payload type.
 */
export type IpcEventPayload<E extends keyof IpcEvents> = IpcEvents[E];

/**
 * All channel names as a union for exhaustive checking.
 */
export type IpcChannelName = keyof IpcChannels;

/**
 * All event names as a union for exhaustive checking.
 */
export type IpcEventName = keyof IpcEvents;

/**
 * Map of channel name to handler function signature.
 * Used for type-safe handler registration in Main.
 */
export type IpcHandlers = {
  [C in IpcChannelName]: (request: IpcRequest<C>) => Promise<IpcResult<IpcResponse<C>>>;
};
