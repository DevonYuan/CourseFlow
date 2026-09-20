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
  Page,
  PageInput,
  PageUpdateInput,
  PageTreeNode,
  PageSearchResult,
  PriorityOrder,
  PriorityOrderInput,
  CalendarSource,
  CalendarSourceInput,
  CalendarSourceUpdateInput,
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
      // Update sub-task by ID
      const updated = repo.updateSubTask(input.id, { completed: input.completed });
      if (!updated) {
        return Promise.resolve(err('Sub-task not found', 'NOT_FOUND'));
      }
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
      return Promise.resolve(ok(repo.listNotes(assignmentId)));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to list notes: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:notes:upsert': (input: NoteInput): Promise<IpcResult<Note>> => {
    try {
      const isUpdate = !!input.id;
      const note = repo.upsertNote(input);
      sendEventToRenderers('db:changed', {
        table: 'notes',
        action: isUpdate ? 'update' : 'insert',
        id: note.id,
      });
      return Promise.resolve(ok(note));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to upsert note: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:notes:delete': (id: string): Promise<IpcResult<void>> => {
    try {
      repo.deleteNote(id);
      sendEventToRenderers('db:changed', { table: 'notes', action: 'delete', id });
      return Promise.resolve(ok(undefined));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  // ── Database: Pages ────────────────────────────────────────────────────

  'db:pages:list': (input: { parentId?: string }): Promise<IpcResult<Page[]>> => {
    try {
      const pages = repo.listPages(input.parentId ?? null);
      return Promise.resolve(ok(pages));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to list pages: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:pages:get': (id: string): Promise<IpcResult<Page | null>> => {
    try {
      const page = repo.getPage(id);
      return Promise.resolve(ok(page));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to get page: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:pages:tree': (): Promise<IpcResult<PageTreeNode[]>> => {
    try {
      const tree = repo.getPageTree();
      return Promise.resolve(ok(tree));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to get page tree: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:pages:create': (input: PageInput): Promise<IpcResult<Page>> => {
    try {
      // Input validation
      if (!input || typeof input !== 'object') {
        return Promise.resolve(err('Invalid input: expected PageInput object', 'VALIDATION_ERROR'));
      }
      if (!input.title || typeof input.title !== 'string' || input.title.trim().length === 0) {
        return Promise.resolve(err('title is required and must be a non-empty string', 'VALIDATION_ERROR'));
      }
      if (input.parentId !== undefined && input.parentId !== null && typeof input.parentId !== 'string') {
        return Promise.resolve(err('parentId must be a string or null', 'VALIDATION_ERROR'));
      }

      const page = repo.createPage(input);
      sendEventToRenderers('db:changed', { table: 'pages', action: 'insert', id: page.id });
      return Promise.resolve(ok(page));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to create page: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:pages:update': (input: PageUpdateInput): Promise<IpcResult<Page>> => {
    try {
      // Input validation
      if (!input || typeof input !== 'object') {
        return Promise.resolve(err('Invalid input: expected PageUpdateInput object', 'VALIDATION_ERROR'));
      }
      if (!input.id || typeof input.id !== 'string' || input.id.trim().length === 0) {
        return Promise.resolve(err('id is required and must be a non-empty string', 'VALIDATION_ERROR'));
      }
      if (input.title !== undefined && (typeof input.title !== 'string' || input.title.trim().length === 0)) {
        return Promise.resolve(err('title must be a non-empty string', 'VALIDATION_ERROR'));
      }
      if (input.parentId !== undefined && input.parentId !== null && typeof input.parentId !== 'string') {
        return Promise.resolve(err('parentId must be a string or null', 'VALIDATION_ERROR'));
      }

      const page = repo.updatePage(input);
      sendEventToRenderers('db:changed', { table: 'pages', action: 'update', id: page.id });
      return Promise.resolve(ok(page));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to update page: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:pages:delete': (id: string): Promise<IpcResult<void>> => {
    try {
      repo.deletePage(id);
      sendEventToRenderers('db:changed', { table: 'pages', action: 'delete', id });
      return Promise.resolve(ok(undefined));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to delete page: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:pages:move': (input: { id: string; parentId: string | null; position: number }): Promise<IpcResult<Page>> => {
    try {
      // Input validation
      if (!input || typeof input !== 'object') {
        return Promise.resolve(err('Invalid input: expected move input object', 'VALIDATION_ERROR'));
      }
      if (!input.id || typeof input.id !== 'string' || input.id.trim().length === 0) {
        return Promise.resolve(err('id is required and must be a non-empty string', 'VALIDATION_ERROR'));
      }
      if (input.parentId !== null && (typeof input.parentId !== 'string' || input.parentId.trim().length === 0)) {
        return Promise.resolve(err('parentId must be a string or null', 'VALIDATION_ERROR'));
      }
      if (typeof input.position !== 'number' || !Number.isInteger(input.position) || input.position < 0) {
        return Promise.resolve(err('position must be a non-negative integer', 'VALIDATION_ERROR'));
      }

      const page = repo.movePage(input.id, input.parentId, input.position);
      sendEventToRenderers('db:changed', { table: 'pages', action: 'reorder', id: page.id });
      return Promise.resolve(ok(page));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to move page: ${error instanceof Error ? error.message : 'Unknown error'}`),
      );
    }
  },

  'db:pages:search': (input: { query: string; limit?: number }): Promise<IpcResult<PageSearchResult[]>> => {
    try {
      if (!input || typeof input !== 'object') {
        return Promise.resolve(err('Invalid input: expected search input object', 'VALIDATION_ERROR'));
      }
      if (typeof input.query !== 'string') {
        return Promise.resolve(err('query must be a string', 'VALIDATION_ERROR'));
      }
      const limit = input.limit ?? 20;
      if (typeof limit !== 'number' || limit < 1 || limit > 100) {
        return Promise.resolve(err('limit must be a number between 1 and 100', 'VALIDATION_ERROR'));
      }

      const results = repo.searchPages(input.query, limit);
      return Promise.resolve(ok(results));
    } catch (error) {
      return Promise.resolve(
        err(`Failed to search pages: ${error instanceof Error ? error.message : 'Unknown error'}`),
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
        return Promise.resolve(
          err('Expected non-empty array of assignment IDs', 'VALIDATION_ERROR'),
        );
      }
      if (!ids.every((id) => typeof id === 'string' && id.length > 0)) {
        return Promise.resolve(
          err('All assignment IDs must be non-empty strings', 'VALIDATION_ERROR'),
        );
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
        return Promise.resolve(
          err('Invalid input: expected PriorityOrderInput object', 'VALIDATION_ERROR'),
        );
      }
      if (
        !input.assignmentId ||
        typeof input.assignmentId !== 'string' ||
        input.assignmentId.length === 0
      ) {
        return Promise.resolve(
          err('assignmentId is required and must be a non-empty string', 'VALIDATION_ERROR'),
        );
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

  // ── Database: Calendar Sources ─────────────────────────────────────────

  'db:calendars:list': (): Promise<IpcResult<CalendarSource[]>> => {
    try {
      return Promise.resolve(ok(repo.listCalendars()));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to list calendars: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:calendars:get': (id: string): Promise<IpcResult<CalendarSource | null>> => {
    try {
      // Validate input
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return Promise.resolve(err('id is required and must be a non-empty string', 'VALIDATION_ERROR'));
      }

      const calendar = repo.getCalendar(id);
      if (!calendar) {
        return Promise.resolve(err('Calendar not found', 'NOT_FOUND'));
      }
      return Promise.resolve(ok(calendar));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to get calendar: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  },

  'db:calendars:create': async (input: CalendarSourceInput): Promise<IpcResult<CalendarSource>> => {
    try {
      // Input validation
      if (!input || typeof input !== 'object') {
        return err('Invalid input: expected CalendarSourceInput object', 'VALIDATION_ERROR');
      }
      if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
        return err('name is required and must be a non-empty string', 'VALIDATION_ERROR');
      }
      if (!input.feedUrl || typeof input.feedUrl !== 'string' || input.feedUrl.trim().length === 0) {
        return err('feedUrl is required and must be a non-empty string', 'VALIDATION_ERROR');
      }
      try {
        new URL(input.feedUrl);
      } catch {
        return err('Invalid feedUrl format', 'VALIDATION_ERROR');
      }
      if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
        return err('enabled must be a boolean', 'VALIDATION_ERROR');
      }
      if (input.color !== undefined) {
        if (typeof input.color !== 'string') {
          return err('color must be a string', 'VALIDATION_ERROR');
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) {
          return err('color must be a valid hex color (e.g., #3b82f6)', 'VALIDATION_ERROR');
        }
      }
      if (input.position !== undefined && (typeof input.position !== 'number' || !Number.isInteger(input.position) || input.position < 0)) {
        return err('position must be a non-negative integer', 'VALIDATION_ERROR');
      }

      const calendar = await repo.createCalendar(input);
      sendEventToRenderers('db:changed', { table: 'calendars', action: 'insert', id: calendar.id });
      return ok(calendar);
    } catch (error) {
      return err(
        `Failed to create calendar: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  'db:calendars:update': async (input: CalendarSourceUpdateInput): Promise<IpcResult<CalendarSource>> => {
    try {
      // Input validation
      if (!input || typeof input !== 'object') {
        return err('Invalid input: expected CalendarSourceUpdateInput object', 'VALIDATION_ERROR');
      }
      if (!input.id || typeof input.id !== 'string' || input.id.trim().length === 0) {
        return err('id is required and must be a non-empty string', 'VALIDATION_ERROR');
      }
      if (input.name !== undefined && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
        return err('name must be a non-empty string', 'VALIDATION_ERROR');
      }
      if (input.feedUrl !== undefined) {
        if (typeof input.feedUrl !== 'string' || input.feedUrl.trim().length === 0) {
          return err('feedUrl must be a non-empty string', 'VALIDATION_ERROR');
        }
        try {
          new URL(input.feedUrl);
        } catch {
          return err('Invalid feedUrl format', 'VALIDATION_ERROR');
        }
      }
      if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
        return err('enabled must be a boolean', 'VALIDATION_ERROR');
      }
      if (input.color !== undefined) {
        if (typeof input.color !== 'string') {
          return err('color must be a string', 'VALIDATION_ERROR');
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) {
          return err('color must be a valid hex color (e.g., #3b82f6)', 'VALIDATION_ERROR');
        }
      }
      if (input.position !== undefined && (typeof input.position !== 'number' || !Number.isInteger(input.position) || input.position < 0)) {
        return err('position must be a non-negative integer', 'VALIDATION_ERROR');
      }

      // Check if calendar exists first
      const existing = repo.getCalendar(input.id);
      if (!existing) {
        return err('Calendar not found', 'NOT_FOUND');
      }

      const calendar = await repo.updateCalendar(input);
      sendEventToRenderers('db:changed', { table: 'calendars', action: 'update', id: calendar.id });
      return ok(calendar);
    } catch (error) {
      return err(
        `Failed to update calendar: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  'db:calendars:delete': async (id: string): Promise<IpcResult<void>> => {
    try {
      // Validate input
      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        return err('id is required and must be a non-empty string', 'VALIDATION_ERROR');
      }

      // Check if calendar exists
      const calendar = repo.getCalendar(id);
      if (!calendar) {
        return err('Calendar not found', 'NOT_FOUND');
      }

      // `deleteCalendar` is async — await it so the row is actually removed
      // before we report success and announce the change.
      await repo.deleteCalendar(id);
      sendEventToRenderers('db:changed', { table: 'calendars', action: 'delete', id });
      return ok(undefined);
    } catch (error) {
      return err(
        `Failed to delete calendar: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  'db:calendars:reorder': (ids: string[]): Promise<IpcResult<void>> => {
    try {
      // Input validation: non-empty array of strings
      if (!Array.isArray(ids) || ids.length === 0) {
        return Promise.resolve(
          err('Expected non-empty array of calendar IDs', 'VALIDATION_ERROR'),
        );
      }
      if (!ids.every((id) => typeof id === 'string' && id.length > 0)) {
        return Promise.resolve(
          err('All calendar IDs must be non-empty strings', 'VALIDATION_ERROR'),
        );
      }

      // Verify all calendars exist
      for (const calendarId of ids) {
        const calendar = repo.getCalendar(calendarId);
        if (!calendar) {
          return Promise.resolve(err(`Calendar not found: ${calendarId}`, 'NOT_FOUND'));
        }
      }

      repo.reorderCalendars(ids);

      // Emit single reorder event for all calendars
      sendEventToRenderers('db:changed', {
        table: 'calendars',
        action: 'reorder',
        id: 'all',
      });

      return Promise.resolve(ok(undefined));
    } catch (error) {
      return Promise.resolve(
        err(
          `Failed to reorder calendars: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INTERNAL_ERROR',
        ),
      );
    }
  },

  'db:calendars:setEnabled': async (input: { id: string; enabled: boolean }): Promise<IpcResult<CalendarSource>> => {
    try {
      // Input validation
      if (!input || typeof input !== 'object') {
        return err('Invalid input: expected { id: string; enabled: boolean }', 'VALIDATION_ERROR');
      }
      if (!input.id || typeof input.id !== 'string' || input.id.trim().length === 0) {
        return err('id is required and must be a non-empty string', 'VALIDATION_ERROR');
      }
      if (typeof input.enabled !== 'boolean') {
        return err('enabled must be a boolean', 'VALIDATION_ERROR');
      }

      // Check if calendar exists
      const existing = repo.getCalendar(input.id);
      if (!existing) {
        return err('Calendar not found', 'NOT_FOUND');
      }

      const calendar = await repo.setCalendarEnabled(input.id, input.enabled);
      sendEventToRenderers('db:changed', { table: 'calendars', action: 'update', id: calendar.id });
      return ok(calendar);
    } catch (error) {
      return err(
        `Failed to set calendar enabled: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      sendEventToRenderers('ical:progress', {
        stage: 'fetching',
        progress: 10,
        message: 'Fetching calendar...',
      });

      // Fetch iCal feed with 30s timeout
      const icalText = await fetchICalFeed(input.url, { timeoutMs: 30_000 });

      // Emit parse progress
      sendEventToRenderers('ical:progress', {
        stage: 'parsing',
        progress: 30,
        message: 'Parsing events...',
      });

      // Parse iCal feed
      const events = parseICalFeed(icalText);

      // Emit completion progress
      sendEventToRenderers('ical:progress', {
        stage: 'complete',
        progress: 100,
        message: `Fetched ${events.length} events`,
      });

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
      return err(`Failed to fetch iCal feed: ${message}`, 'INTERNAL_ERROR');
    }
  },

  'ical:import': async (input: {
    events: ICalEvent[];
    sourceUrl: string;
    sourceId?: string;
  }): Promise<IpcResult<ImportResult>> => {
    try {
      // Validate input
      if (!input.events || !Array.isArray(input.events) || input.events.length === 0) {
        return err('Events array is required and cannot be empty', 'VALIDATION_ERROR');
      }
      if (!input.sourceUrl || typeof input.sourceUrl !== 'string') {
        return err('sourceUrl is required', 'VALIDATION_ERROR');
      }
      if (input.sourceId !== undefined && typeof input.sourceId !== 'string') {
        return err('sourceId must be a string', 'VALIDATION_ERROR');
      }

      // Emit importing progress
      sendEventToRenderers('ical:progress', {
        stage: 'importing',
        progress: 10,
        message: 'Importing assignments...',
        sourceId: input.sourceId,
      });

      // Map iCal events to assignments
      const assignments = mapICalToAssignments(input.events, input.sourceUrl, input.sourceId);

      // Import assignments with deduplication
      console.log('[ical:import] Import completed, updating lastSyncAt');
      const result = repo.importAssignments(assignments, input.sourceId);
      console.log('[ical:import] Import result:', result);

      // Update lastSyncAt in settings on successful import (legacy)
      // Also update the calendar source's last_sync_at
      const now = new Date().toISOString() as IsoDateTime;
      const nowMs = Date.now();
      console.log('[ical:import] Setting lastSyncAt:', now);
      await repo.setSettings({ lastSyncAt: now });
      console.log('[ical:import] lastSyncAt updated');

      // Update calendar source's last_sync_at if sourceId provided
      if (input.sourceId) {
        // Get sync interval from settings
        const settings = await repo.getAllSettings();
        const intervalMinutes = settings.syncIntervalMinutes ?? 15;
        await repo.updateCalendarSyncTime(input.sourceId, nowMs, intervalMinutes);
      }

      // Emit completion progress
      sendEventToRenderers('ical:progress', {
        stage: 'complete',
        progress: 100,
        message: `Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}`,
        sourceId: input.sourceId,
      });

      return ok(result);
    } catch (error) {
      // Emit error progress
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ical:import] Error:', error);
      sendEventToRenderers('ical:progress', { stage: 'error', progress: 100, message, sourceId: input.sourceId });

      return err(`Failed to import assignments: ${message}`, 'INTERNAL_ERROR');
    }
  },

  // ── Settings ───────────────────────────────────────────────────────────

  'settings:get': async (): Promise<IpcResult<Settings>> => {
    try {
      const settings = await repo.getAllSettings();
      return ok(settings);
    } catch (error) {
      return err(
        `Failed to get settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  'settings:set': async (partial: Partial<Settings>): Promise<IpcResult<Settings>> => {
    try {
      const settings = await repo.setSettings(partial);
      sendEventToRenderers('settings:changed', settings);
      updateScheduler(settings);
      return ok(settings);
    } catch (error) {
      return err(
        `Failed to set settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
  'scheduler:start': async (input: {
    intervalMinutes: number;
  }): Promise<IpcResult<SchedulerStatus>> => {
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
      return err(
        `Failed to start scheduler: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
      return err(
        `Failed to stop scheduler: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  'scheduler:status': async (): Promise<IpcResult<SchedulerStatus>> => {
    try {
      const { getScheduler } = await import('./scheduler.js');
      const scheduler = getScheduler();
      const status = scheduler.getStatus();
      return ok(status);
    } catch (error) {
      return err(
        `Failed to get scheduler status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  'scheduler:trigger': async (input?: { sourceId?: string }): Promise<IpcResult<void>> => {
    try {
      const { getScheduler } = await import('./scheduler.js');
      const scheduler = getScheduler();
      await scheduler.triggerManual(input?.sourceId);
      return ok(undefined);
    } catch (error) {
      return err(
        `Failed to trigger scheduler: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
      return err(
        `Failed to get scheduler config: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },

  'scheduler:config:set': async (
    partial: Partial<SchedulerConfig>,
  ): Promise<IpcResult<SchedulerConfig>> => {
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

      const updatedSettings = {
        ...settings,
        syncIntervalMinutes: newInterval,
        autoFetchIcal: newEnabled,
      };
      scheduler.updateSettings(updatedSettings);

      const status = scheduler.getStatus();
      return ok({
        enabled: status.running,
        intervalMinutes: status.intervalMinutes,
        lastRun: status.lastRun,
        nextRun: status.nextRun,
      });
    } catch (error) {
      return err(
        `Failed to set scheduler config: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
  ipcMain.on('settings:changed', (_event, settings: Settings) => {
    void import('./scheduler.js').then(({ getScheduler }) => {
      getScheduler().updateSettings(settings);
    });
  });
}
