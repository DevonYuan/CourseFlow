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
  ImportResult,
  IsoDateTime,
  SchedulerConfig,
  SchedulerStatus,
} from '../shared/types.js';

import { repo } from './db/repository.js';
import { sendEventToRenderers } from './events.js';
import {
  fetchICalFeed,
  parseICalFeed,
  mapICalToAssignments,
  NetworkError,
  HttpError,
  TimeoutError,
  ICalParseError,
} from './ical/index.js';
import { updateScheduler } from './scheduler.js';

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
      // Check if assignment exists to determine insert vs update
      const existing = repo.getAssignment(input.id);
      const action = existing ? 'update' : 'insert';
      const assignment = repo.upsertAssignment(input);
      sendEventToRenderers('db:changed', {
        table: 'assignments',
        action,
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
      // SubTaskInput has no ID, so this is always an insert
      sendEventToRenderers('db:changed', { table: 'sub_tasks', action: 'insert', id: subTask.id });
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
      // Check if note exists to determine insert vs update
      const existing = repo.getNote(input.assignmentId);
      const action = existing ? 'update' : 'insert';
      const note = repo.setNote(input.assignmentId, input.content);
      sendEventToRenderers('db:changed', {
        table: 'notes',
        action,
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
      const orders = repo.getAllPriorityOrders();
      return Promise.resolve(ok(orders));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to get priority order: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INTERNAL_ERROR',
        ),
      );
    }
  },

  'db:priority:reorder': (ids: string[]): Promise<IpcResult<void>> => {
    try {
      // Input validation: non-empty array of strings
      if (!Array.isArray(ids) || ids.length === 0) {
        return Promise.resolve(err('Expected non-empty array of assignment IDs', 'VALIDATION_ERROR'));
      }
      if (!ids.every((id) => typeof id === 'string' && id.length > 0)) {
        return Promise.resolve(err('All assignment IDs must be non-empty strings', 'VALIDATION_ERROR'));
      }

      repo.reorderPriority(ids);

      // Emit db:changed for each affected assignment with 'update' action
      for (const assignmentId of ids) {
        sendEventToRenderers('db:changed', {
          table: 'priority_order',
          action: 'update',
          id: assignmentId,
        });
      }

      return Promise.resolve(ok(undefined));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to reorder priority: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INTERNAL_ERROR',
        ),
      );
    }
  },

  'db:priority:upsert': (input: PriorityOrderInput): Promise<IpcResult<PriorityOrder>> => {
    try {
      // Input validation: valid assignment_id and position >= 0
      if (!input || typeof input !== 'object') {
        return Promise.resolve(err('Invalid input: expected PriorityOrderInput object', 'VALIDATION_ERROR'));
      }
      if (!input.assignmentId || typeof input.assignmentId !== 'string' || input.assignmentId.length === 0) {
        return Promise.resolve(err('assignmentId is required and must be a non-empty string', 'VALIDATION_ERROR'));
      }
      if (typeof input.order !== 'number' || !Number.isInteger(input.order) || input.order < 0) {
        return Promise.resolve(err('order must be a non-negative integer', 'VALIDATION_ERROR'));
      }

      // Check if entry exists to determine insert vs update
      const existing = repo.getPriorityOrderByAssignmentId(input.assignmentId);
      const action = existing ? 'update' : 'insert';

      const order = repo.upsertPriorityOrder(input);
      sendEventToRenderers('db:changed', {
        table: 'priority_order',
        action,
        id: input.assignmentId,
      });
      return Promise.resolve(ok(order));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to upsert priority order: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INTERNAL_ERROR',
        ),
      );
    }
  },

  // ── iCal Integration ───────────────────────────────────────────────────

  'ical:fetch': async (input: { url: string }): Promise<IpcResult<ICalEvent[]>> => {
    try {
      // Validate URL
      if (!input.url || typeof input.url !== 'string') {
        return err('URL is required', 'VALIDATION_ERROR');
      }
      try {
        new URL(input.url);
      } catch {
        return err('Invalid URL format', 'VALIDATION_ERROR');
      }

      // Emit fetch progress
      sendEventToRenderers('ical:progress', { stage: 'fetching', progress: 10, message: 'Fetching calendar...' });

      // Fetch iCal feed with 30s timeout
      const icalText = await fetchICalFeed(input.url, { timeoutMs: 30_000 });

      // Emit parse progress
      sendEventToRenderers('ical:progress', { stage: 'parsing', progress: 30, message: 'Parsing events...' });

      // Parse iCal feed
      const events = parseICalFeed(icalText);

      // Emit completion progress
      sendEventToRenderers('ical:progress', { stage: 'complete', progress: 100, message: `Fetched ${events.length} events` });

      return ok(events);
    } catch (error) {
      // Emit error progress
      const message = error instanceof Error ? error.message : 'Unknown error';
      sendEventToRenderers('ical:progress', { stage: 'error', progress: 100, message });

      if (error instanceof NetworkError) {
        return err(`Network error: ${error.message}`, 'NETWORK_ERROR');
      }
      if (error instanceof HttpError) {
        return err(`HTTP error ${error.status}: ${error.message}`, 'HTTP_ERROR');
      }
      if (error instanceof TimeoutError) {
        return err(`Request timeout: ${error.message}`, 'TIMEOUT_ERROR');
      }
      if (error instanceof ICalParseError) {
        return err(`Failed to parse iCal feed: ${error.message}`, 'PARSE_ERROR');
      }
      return err(
        `Failed to fetch iCal feed: ${message}`,
        'INTERNAL_ERROR',
      );
    }
  },

  'ical:import': async (input: {
    events: ICalEvent[];
    sourceUrl: string;
  }): Promise<IpcResult<ImportResult>> => {
    try {
      // Validate input
      if (!input.events || !Array.isArray(input.events) || input.events.length === 0) {
        return err('Events array is required and cannot be empty', 'VALIDATION_ERROR');
      }
      if (!input.sourceUrl || typeof input.sourceUrl !== 'string') {
        return err('sourceUrl is required', 'VALIDATION_ERROR');
      }

      // Emit importing progress
      sendEventToRenderers('ical:progress', { stage: 'importing', progress: 10, message: 'Importing assignments...' });

      // Map iCal events to assignments
      const assignments = mapICalToAssignments(input.events, input.sourceUrl);

      // Import assignments with deduplication
      console.log('[ical:import] Import completed, updating lastSyncAt');
      const result = repo.importAssignments(assignments);
      console.log('[ical:import] Import result:', result);

      // Update lastSyncAt in settings on successful import
      const now = new Date().toISOString() as IsoDateTime;
      console.log('[ical:import] Setting lastSyncAt:', now);
      await repo.setSettings({ lastSyncAt: now });
      console.log('[ical:import] lastSyncAt updated');

      // Emit completion progress
      sendEventToRenderers('ical:progress', {
        stage: 'complete',
        progress: 100,
        message: `Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}`,
      });

      return ok(result);
    } catch (error) {
      // Emit error progress
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ical:import] Error:', error);
      sendEventToRenderers('ical:progress', { stage: 'error', progress: 100, message });

      return err(
        `Failed to import assignments: ${message}`,
        'INTERNAL_ERROR',
      );
    }
  },

  // ── Settings ───────────────────────────────────────────────────────────

  'settings:get': async (): Promise<IpcResult<Settings>> => {
    try {
      const settings = await repo.getAllSettings();
      return ok(settings);
    } catch (error) {
      return err(`Failed to get settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  'settings:set': async (partial: Partial<Settings>): Promise<IpcResult<Settings>> => {
    try {
      const settings = await repo.setSettings(partial);
      sendEventToRenderers('settings:changed', settings);
      updateScheduler(settings);
      return ok(settings);
    } catch (error) {
      return err(`Failed to set settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  'settings:reset': async (): Promise<IpcResult<Settings>> => {
    try {
      const settings = await repo.resetSettings();
      sendEventToRenderers('settings:changed', settings);
      updateScheduler(settings);
      return ok(settings);
    } catch (error) {
      return err(
        `Failed to reset settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  // ── App ────────────────────────────────────────────────────────────────
  'app:version': async (): Promise<IpcResult<string>> => {
    const { app } = await import('electron');
    return ok(app.getVersion());
  },

  // ── Scheduler ──────────────────────────────────────────────────────────
  'scheduler:start': async (input: { intervalMinutes: number }): Promise<IpcResult<SchedulerStatus>> => {
    try {
      // Input validation: intervalMinutes must be > 0
      if (!input || typeof input.intervalMinutes !== 'number' || input.intervalMinutes <= 0) {
        return err('intervalMinutes must be a positive number', 'VALIDATION_ERROR');
      }

      const { getScheduler } = await import('./scheduler.js');
      const scheduler = getScheduler();
      scheduler.start(input.intervalMinutes);
      const status = scheduler.getStatus();
      return ok(status);
    } catch (error) {
      return err(`Failed to start scheduler: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  'scheduler:stop': async (): Promise<IpcResult<SchedulerStatus>> => {
    try {
      const { getScheduler } = await import('./scheduler.js');
      const scheduler = getScheduler();
      scheduler.stop();
      const status = scheduler.getStatus();
      return ok(status);
    } catch (error) {
      return err(`Failed to stop scheduler: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  'scheduler:status': async (): Promise<IpcResult<SchedulerStatus>> => {
    try {
      const { getScheduler } = await import('./scheduler.js');
      const scheduler = getScheduler();
      const status = scheduler.getStatus();
      return ok(status);
    } catch (error) {
      return err(`Failed to get scheduler status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  'scheduler:trigger': async (): Promise<IpcResult<void>> => {
    try {
      const { getScheduler } = await import('./scheduler.js');
      const scheduler = getScheduler();
      await scheduler.triggerManual();
      return ok(undefined);
    } catch (error) {
      return err(`Failed to trigger scheduler: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  'scheduler:config:get': async (): Promise<IpcResult<SchedulerConfig>> => {
    try {
      const { getScheduler } = await import('./scheduler.js');
      const scheduler = getScheduler();
      const status = scheduler.getStatus();
      return ok({
        enabled: status.running,
        intervalMinutes: status.intervalMinutes,
        lastRun: status.lastRun,
        nextRun: status.nextRun,
      });
    } catch (error) {
      return err(`Failed to get scheduler config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  'scheduler:config:set': async (partial: Partial<SchedulerConfig>): Promise<IpcResult<SchedulerConfig>> => {
    try {
      const { getScheduler } = await import('./scheduler.js');
      const scheduler = getScheduler();
      const { repo } = await import('./db/repository.js');
      const settings = await repo.getAllSettings();

      let newInterval = settings.syncIntervalMinutes;
      let newEnabled = settings.autoFetchIcal;

      if (partial.intervalMinutes !== undefined) {
        newInterval = partial.intervalMinutes;
      }
      if (partial.enabled !== undefined) {
        newEnabled = partial.enabled;
      }

      const updatedSettings = { ...settings, syncIntervalMinutes: newInterval, autoFetchIcal: newEnabled };
      scheduler.updateSettings(updatedSettings);

      const status = scheduler.getStatus();
      return ok({
        enabled: status.running,
        intervalMinutes: status.intervalMinutes,
        lastRun: status.lastRun,
        nextRun: status.nextRun,
      });
    } catch (error) {
      return err(`Failed to set scheduler config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  // Listen for settings changes to restart scheduler when sync_interval_minutes changes
  ipcMain.on('settings:changed', async (_event, settings: Settings) => {
    const { getScheduler } = await import('./scheduler.js');
    const scheduler = getScheduler();
    scheduler.updateSettings(settings);
  });
}
