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
  Page,
  PageInput,
  PageUpdateInput,
  PageTreeNode,
  PageSearchResult,
  PriorityOrder,
  PriorityOrderInput,
  Settings,
  CalendarSource,
  CalendarSourceInput,
  CalendarSourceUpdateInput,
  ICalEvent,
  SchedulerConfig,
  SchedulerStatus,
  IsoDateTime,
  ImportResult,
} from './types.js';

/**
 * Re-export domain types for consumers (Preload, Renderer).
 * These are part of the IPC contract for various channels.
 */


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
  NETWORK_ERROR: 'NETWORK_ERROR',
  HTTP_ERROR: 'HTTP_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
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

  // ── Database: Pages ────────────────────────────────────────────────────
  'db:pages:list': {
    request: { parentId?: string };
    response: Page[];
  };
  'db:pages:get': {
    request: string; // id
    response: Page | null;
  };
  'db:pages:tree': {
    request: void;
    response: PageTreeNode[];
  };
  'db:pages:create': {
    request: PageInput;
    response: Page;
  };
  'db:pages:update': {
    request: PageUpdateInput;
    response: Page;
  };
  'db:pages:delete': {
    request: string; // id
    response: void;
  };
  'db:pages:move': {
    request: { id: string; parentId: string | null; position: number };
    response: Page;
  };
  'db:pages:search': {
    request: { query: string; limit?: number };
    response: PageSearchResult[];
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

  // ── Database: Calendar Sources ─────────────────────────────────────────
  'db:calendars:list': {
    request: void;
    response: CalendarSource[];
  };
  'db:calendars:get': {
    request: string; // id
    response: CalendarSource | null;
  };
  'db:calendars:create': {
    request: CalendarSourceInput;
    response: CalendarSource;
  };
  'db:calendars:update': {
    request: CalendarSourceUpdateInput;
    response: CalendarSource;
  };
  'db:calendars:delete': {
    request: string; // id
    response: void;
  };
  'db:calendars:reorder': {
    request: string[]; // ordered calendar IDs
    response: void;
  };
  'db:calendars:setEnabled': {
    request: { id: string; enabled: boolean };
    response: CalendarSource;
  };

  // ── iCal Integration ───────────────────────────────────────────────────
  'ical:fetch': {
    request: { url: string };
    response: ICalEvent[];
  };
  'ical:import': {
    request: { events: ICalEvent[]; sourceUrl: string; sourceId?: string };
    response: ImportResult;
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

  // ── Scheduler ──────────────────────────────────────────────────────────
  'scheduler:start': {
    request: { intervalMinutes: number };
    response: SchedulerStatus;
  };
  'scheduler:stop': {
    request: void;
    response: SchedulerStatus;
  };
  'scheduler:status': {
    request: void;
    response: SchedulerStatus;
  };
  'scheduler:trigger': {
    request: { sourceId?: string } | undefined;
    response: void;
  };
  'scheduler:config:get': {
    request: void;
    response: SchedulerConfig;
  };
  'scheduler:config:set': {
    request: Partial<SchedulerConfig>;
    response: SchedulerConfig;
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
    action: 'insert' | 'update' | 'delete' | 'reorder';
    id: string;
  };
  'ical:progress': {
    stage: 'fetching' | 'parsing' | 'importing' | 'complete' | 'error';
    progress: number;
    message?: string;
    sourceId?: string; // Source ID for multi-calendar progress tracking
    sourceName?: string; // Source name for multi-calendar progress tracking
  };
  'settings:changed': Settings;
  'scheduler:tick': {
    nextRun: IsoDateTime;
    sourceId?: string; // Source ID for multi-calendar scheduling
  };
  'scheduler:error': {
    message: string;
    code: 'network' | 'auth' | 'parse' | 'server' | 'unknown';
    sourceId?: string; // Source ID for multi-calendar error tracking
    sourceName?: string; // Source name for multi-calendar error tracking
  };
  'scheduler:coalesced': {
    message: string;
    sourceIds?: string[]; // Source IDs that are already syncing
  };
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

export {type Settings, type CalendarSource, type CalendarSourceInput, type CalendarSourceUpdateInput} from './types.js';