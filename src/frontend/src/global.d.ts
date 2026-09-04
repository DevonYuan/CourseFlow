// Window API Type Declarations
//
// Provides TypeScript types for the Electron contextBridge API exposed
// as `window.api` in the renderer process.

import type { IpcResult, IpcChannels, IpcEvents } from '@backend/shared/ipc';
import type { Assignment, PriorityOrder, Settings, SubTask, Note, SubTaskInput, NoteInput, PriorityOrderInput } from '@backend/shared/types';

declare global {
  interface Window {
    api: {
      db: {
        assignments: {
          list: () => Promise<IpcResult<Assignment[]>>;
          get: (id: string) => Promise<IpcResult<Assignment | null>>;
          upsert: (input: Partial<Assignment> & { id: string }) => Promise<IpcResult<Assignment>>;
          delete: (id: string) => Promise<IpcResult<void>>;
        };
        subtasks: {
          list: (assignmentId: string) => Promise<IpcResult<SubTask[]>>;
          upsert: (input: SubTaskInput) => Promise<IpcResult<SubTask>>;
          delete: (id: string) => Promise<IpcResult<void>>;
          toggle: (input: { id: string; completed: boolean }) => Promise<IpcResult<SubTask>>;
        };
        notes: {
          list: (assignmentId: string) => Promise<IpcResult<Note[]>>;
          upsert: (input: NoteInput) => Promise<IpcResult<Note>>;
          delete: (id: string) => Promise<IpcResult<void>>;
        };
        priority: {
          list: () => Promise<IpcResult<PriorityOrder[]>>;
          reorder: (ids: string[]) => Promise<IpcResult<void>>;
          upsert: (input: PriorityOrderInput) => Promise<IpcResult<PriorityOrder>>;
        };
      };
      ical: {
        fetch: (url: string) => Promise<IpcResult<ICalEvent[]>>;
        import: (input: { events: ICalEvent[]; sourceUrl: string }) => Promise<IpcResult<{ imported: number; updated: number; skipped: number }>>;
      };
      settings: {
        get: () => Promise<IpcResult<Settings>>;
        set: (partial: Partial<Settings>) => Promise<IpcResult<Settings>>;
        reset: () => Promise<IpcResult<Settings>>;
      };
      app: {
        version: () => Promise<IpcResult<string>>;
      };
      scheduler: {
        start: (input: { intervalMinutes: number }) => Promise<IpcResult<SchedulerStatus>>;
        stop: () => Promise<IpcResult<SchedulerStatus>>;
        status: () => Promise<IpcResult<SchedulerStatus>>;
        trigger: () => Promise<IpcResult<void>>;
        onTick: (callback: (payload: IpcEvents['scheduler:tick']) => void) => () => void;
        onError: (callback: (payload: IpcEvents['scheduler:error']) => void) => () => void;
        onCoalesced: (callback: (payload: IpcEvents['scheduler:coalesced']) => void) => () => void;
      };
      // Event subscriptions — return cleanup function
      onDbChanged: (callback: (payload: IpcEvents['db:changed']) => void) => () => void;
      onIcalProgress: (callback: (payload: IpcEvents['ical:progress']) => void) => () => void;
      onSettingsChanged: (callback: (payload: IpcEvents['settings:changed']) => void) => () => void;
      // Scheduler event aliases (for backward compatibility / convenience)
      onSchedulerTick: (callback: (payload: IpcEvents['scheduler:tick']) => void) => () => void;
      onSchedulerError: (callback: (payload: IpcEvents['scheduler:error']) => void) => () => void;
    };
  }
}

export {};