/**
 * IPC Handlers — Main Process
 *
 * Skeleton implementations for all channels defined in @backend/shared/ipc.
 * Each handler returns IpcResult<T> — never throws across IPC boundary.
 *
 * @module @backend/main/ipc-handlers
 */

import { BrowserWindow, ipcMain } from 'electron';

import type { IpcEvents, IpcResult, IpcHandlers } from '../shared/ipc.js';
import type {
  Assignment,
  AssignmentInput,
  SubTask,
  SubTaskInput,
  Note,
  NoteInput,
  PriorityOrder,
  PriorityOrderInput,
  ICalEvent,
  Settings,
} from '../shared/types.js';

/**
 * Error factory for consistent error responses.
 */
function err<T>(message: string, code?: string): IpcResult<T> {
  return { ok: false, error: message, code };
}

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

/**
 * Not implemented placeholder — replace with real logic in downstream tickets.
 */
function notImplemented<T>(channel: string): Promise<IpcResult<T>> {
  return Promise.resolve(err<T>(`Handler not implemented: ${channel}`, 'INTERNAL_ERROR'));
}

/**
 * Type-safe handler map — keys must match IpcChannels exactly.
 * TypeScript will error if a channel is missing or has wrong signature.
 */
const handlers: IpcHandlers = {
  // ── Database: Assignments ──────────────────────────────────────────────

  'db:assignments:list': async (): Promise<IpcResult<Assignment[]>> =>
    notImplemented('db:assignments:list'),

  'db:assignments:get': async (_id: string): Promise<IpcResult<Assignment | null>> =>
    notImplemented('db:assignments:get'),

  'db:assignments:upsert': async (_input: AssignmentInput): Promise<IpcResult<Assignment>> =>
    notImplemented('db:assignments:upsert'),
  'db:assignments:delete': async (_id: string): Promise<IpcResult<void>> =>
    notImplemented('db:assignments:delete'),

  // ── Database: SubTasks ─────────────────────────────────────────────────

  'db:subtasks:list': async (_assignmentId: string): Promise<IpcResult<SubTask[]>> =>
    notImplemented('db:subtasks:list'),

  'db:subtasks:upsert': async (_input: SubTaskInput): Promise<IpcResult<SubTask>> =>
    notImplemented('db:subtasks:upsert'),
  'db:subtasks:delete': async (_id: string): Promise<IpcResult<void>> =>
    notImplemented('db:subtasks:delete'),

  'db:subtasks:toggle': async (_input: {
    id: string;
    completed: boolean;
  }): Promise<IpcResult<SubTask>> => notImplemented('db:subtasks:toggle'),

  // ── Database: Notes ────────────────────────────────────────────────────

  'db:notes:list': async (_assignmentId: string): Promise<IpcResult<Note[]>> =>
    notImplemented('db:notes:list'),

  'db:notes:upsert': async (_input: NoteInput): Promise<IpcResult<Note>> =>
    notImplemented('db:notes:upsert'),
  'db:notes:delete': async (_id: string): Promise<IpcResult<void>> =>
    notImplemented('db:notes:delete'),

  // ── Database: Priority Order ───────────────────────────────────────────

  'db:priority:list': async (): Promise<IpcResult<PriorityOrder[]>> =>
    notImplemented('db:priority:list'),
  'db:priority:reorder': async (_ids: string[]): Promise<IpcResult<void>> =>
    notImplemented('db:priority:reorder'),

  'db:priority:upsert': async (_input: PriorityOrderInput): Promise<IpcResult<PriorityOrder>> =>
    notImplemented('db:priority:upsert'),

  // ── iCal Integration ───────────────────────────────────────────────────

  'ical:fetch': async (_input: { url: string }): Promise<IpcResult<ICalEvent[]>> =>
    notImplemented('ical:fetch'),

  'ical:import': async (_input: {
    events: ICalEvent[];
    sourceUrl: string;
  }): Promise<IpcResult<{ imported: number; skipped: number }>> => notImplemented('ical:import'),

  // ── Settings ───────────────────────────────────────────────────────────

  'settings:get': (): Promise<IpcResult<Settings>> => {
    // Return defaults for now — replace with DB-backed settings in phase0-03
    const defaults: Settings = {
      theme: 'system',
      autoFetchIcal: false,
      icalFetchIntervalMinutes: 60,
      defaultPriority: 100,
      showCompletedAssignments: true,
      notifyDueSoon: true,
      dueSoonThresholdHours: 24,
    };
    return Promise.resolve(ok(defaults));
  },

  'settings:set': async (_partial: Partial<Settings>): Promise<IpcResult<Settings>> =>
    notImplemented('settings:set'),
  'settings:reset': async (): Promise<IpcResult<Settings>> => notImplemented('settings:reset'),

  // ── App ────────────────────────────────────────────────────────────────
  'app:version': async (): Promise<IpcResult<string>> => {
    const { app } = await import('electron');
    return ok(app.getVersion());
  },
};

/**
 * Register all IPC handlers with ipcMain.
 * Call this during app initialization (after app.whenReady()).
 */
export function registerIpcHandlers(): void {
  (Object.keys(handlers) as Array<keyof IpcHandlers>).forEach((channel) => {
    const handler = handlers[channel];
    ipcMain.handle(channel, async (_event, request: unknown): Promise<IpcResult<unknown>> => {
      try {
        return await handler(request);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        return { ok: false, error: message, code: 'INTERNAL_ERROR' };
      }
    });
  });
}

/**
 * Send a one-way event to all renderer windows.
 * Used for db:changed, ical:progress, settings:changed notifications.
 */
export function sendEventToRenderers<E extends keyof IpcEvents>(
  _channel: E,
  payload: IpcEvents[E],
): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(_channel, payload);
    }
  }
}
