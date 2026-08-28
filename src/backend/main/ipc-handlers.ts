/**
 * IPC Handlers — Main Process
 *
 * Implements all channels defined in @backend/shared/ipc using the database repository.
 * Each handler returns IpcResult<T> — never throws across IPC boundary.
 *
 * @module @backend/main/ipc-handlers
 */

import { ipcMain } from 'electron';

import type { IpcResult, IpcHandlers } from '../shared/ipc.js';
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

import { repo } from './db/repository.js';
import { sendEventToRenderers } from './events.js';

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
 * Type-safe handler map — keys must match IpcChannels exactly.
 * TypeScript will error if a channel is missing or has wrong signature.
 */
const handlers: IpcHandlers = {
  // ── Database: Assignments ──────────────────────────────────────────────

  'db:assignments:list': (): Promise<IpcResult<Assignment[]>> => {
    try {
      return Promise.resolve(ok(repo.listAssignments()));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to list assignments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:assignments:get': (id: string): Promise<IpcResult<Assignment | null>> => {
    try {
      const assignment = repo.getAssignment(id);
      return Promise.resolve(ok(assignment));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to get assignment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:assignments:upsert': (input: AssignmentInput): Promise<IpcResult<Assignment>> => {
    try {
      const assignment = repo.upsertAssignment(input);
      sendEventToRenderers('db:changed', {
        table: 'assignments',
        action: 'upsert',
        id: assignment.id,
      });
      return Promise.resolve(ok(assignment));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to upsert assignment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:assignments:delete': (id: string): Promise<IpcResult<void>> => {
    try {
      repo.deleteAssignment(id);
      sendEventToRenderers('db:changed', { table: 'assignments', action: 'delete', id });
      return Promise.resolve(ok(undefined));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to delete assignment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  // ── Database: SubTasks ─────────────────────────────────────────────────

  'db:subtasks:list': (assignmentId: string): Promise<IpcResult<SubTask[]>> => {
    try {
      return Promise.resolve(ok(repo.listSubTasks(assignmentId)));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to list sub-tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:subtasks:upsert': (input: SubTaskInput): Promise<IpcResult<SubTask>> => {
    try {
      const subTask = repo.upsertSubTask(input);
      sendEventToRenderers('db:changed', { table: 'sub_tasks', action: 'upsert', id: subTask.id });
      return Promise.resolve(ok(subTask));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to upsert sub-task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:subtasks:delete': (id: string): Promise<IpcResult<void>> => {
    try {
      repo.deleteSubTask(id);
      sendEventToRenderers('db:changed', { table: 'sub_tasks', action: 'delete', id });
      return Promise.resolve(ok(undefined));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to delete sub-task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:subtasks:toggle': (input: {
    id: string;
    completed: boolean;
  }): Promise<IpcResult<SubTask>> => {
    try {
      // Get existing sub-task, toggle completed, then upsert
      const existing = repo.listSubTasks('').find((st) => st.id === input.id);
      if (!existing) {
        return Promise.resolve(err('Sub-task not found', 'NOT_FOUND'));
      }
      const updated = repo.upsertSubTask({
        assignmentId: existing.assignmentId,
        title: existing.title,
        completed: input.completed,
        order: existing.order,
      });
      sendEventToRenderers('db:changed', { table: 'sub_tasks', action: 'update', id: updated.id });
      return Promise.resolve(ok(updated));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to toggle sub-task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  // ── Database: Notes ────────────────────────────────────────────────────

  'db:notes:list': (assignmentId: string): Promise<IpcResult<Note[]>> => {
    try {
      const note = repo.getNote(assignmentId);
      return Promise.resolve(ok(note ? [note] : []));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to get note: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:notes:upsert': (input: NoteInput): Promise<IpcResult<Note>> => {
    try {
      const note = repo.setNote(input.assignmentId, input.content);
      sendEventToRenderers('db:changed', {
        table: 'notes',
        action: 'upsert',
        id: input.assignmentId,
      });
      return Promise.resolve(ok(note));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to upsert note: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:notes:delete': (assignmentId: string): Promise<IpcResult<void>> => {
    try {
      repo.setNote(assignmentId, '');
      sendEventToRenderers('db:changed', { table: 'notes', action: 'delete', id: assignmentId });
      return Promise.resolve(ok(undefined));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  // ── Database: Priority Order ───────────────────────────────────────────

  'db:priority:list': (): Promise<IpcResult<PriorityOrder[]>> => {
    try {
      const ids = repo.getPriorityOrder();
      const orders: PriorityOrder[] = ids.map((id, index) => ({
        id: id as PriorityOrder['id'],
        assignmentId: id as PriorityOrder['assignmentId'],
        order: index,
        updatedAt: new Date().toISOString() as PriorityOrder['updatedAt'],
      }));
      return Promise.resolve(ok(orders));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to get priority order: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:priority:reorder': (ids: string[]): Promise<IpcResult<void>> => {
    try {
      repo.setPriorityOrder(ids);
      sendEventToRenderers('db:changed', { table: 'priority_order', action: 'reorder', id: '' });
      return Promise.resolve(ok(undefined));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to reorder priority: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:priority:upsert': (input: PriorityOrderInput): Promise<IpcResult<PriorityOrder>> => {
    try {
      const order = repo.upsertPriorityOrder(input);
      sendEventToRenderers('db:changed', {
        table: 'priority_order',
        action: 'upsert',
        id: input.assignmentId,
      });
      return Promise.resolve(ok(order));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to upsert priority order: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  // ── iCal Integration ───────────────────────────────────────────────────

  'ical:fetch': (_input: { url: string }): Promise<IpcResult<ICalEvent[]>> =>
    Promise.resolve(err('Not implemented: ical:fetch', 'INTERNAL_ERROR')),

  'ical:import': (_input: {
    events: ICalEvent[];
    sourceUrl: string;
  }): Promise<IpcResult<{ imported: number; skipped: number }>> =>
    Promise.resolve(err('Not implemented: ical:import', 'INTERNAL_ERROR')),

  // ── Settings ───────────────────────────────────────────────────────────

  'settings:get': (): Promise<IpcResult<Settings>> => {
    try {
      return Promise.resolve(ok(repo.getAllSettings()));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to get settings: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'settings:set': (partial: Partial<Settings>): Promise<IpcResult<Settings>> => {
    try {
      const current = repo.getAllSettings();
      const updated = { ...current, ...partial };
      for (const [key, value] of Object.entries(updated)) {
        repo.setSetting(key, value);
      }
      sendEventToRenderers('settings:changed', updated);
      return Promise.resolve(ok(updated));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to set settings: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'settings:reset': (): Promise<IpcResult<Settings>> => {
    try {
      const defaults: Settings = {
        theme: 'system',
        autoFetchIcal: false,
        icalFetchIntervalMinutes: 60,
        defaultPriority: 100,
        showCompletedAssignments: true,
        notifyDueSoon: true,
        dueSoonThresholdHours: 24,
      };
      for (const [key, value] of Object.entries(defaults)) {
        repo.setSetting(key, value);
      }
      sendEventToRenderers('settings:changed', defaults);
      return Promise.resolve(ok(defaults));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to reset settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

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
        // Type-safe handler invocation - handlers are typed by channel
        return await (handler as (request: unknown) => Promise<IpcResult<unknown>>)(request);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';

        return { ok: false, error: message, code: 'INTERNAL_ERROR' };
      }
    });
  });
}
