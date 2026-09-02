/**
 * IPC Handlers — Main Process
 *
 * Implements all channels defined in @backend/shared/ipc using the database repository.
 * Each handler returns IpcResult<T> — never throws across IPC boundary.
 *
 * @module @backend/main/ipc-handlers
 */
import { ipcMain } from 'electron';
import { repo } from './db/repository.js';
import { sendEventToRenderers } from './events.js';
import { fetchICalFeed, parseICalFeed, mapICalToAssignments, NetworkError, HttpError, TimeoutError, ICalParseError, } from './ical/index.js';
/**
 * Error factory for consistent error responses.
 */
function err(message, code) {
    return { ok: false, error: message, code };
}
function ok(data) {
    return { ok: true, data };
}
/**
 * Type-safe handler map — keys must match IpcChannels exactly.
 * TypeScript will error if a channel is missing or has wrong signature.
 */
const handlers = {
    // ── Database: Assignments ──────────────────────────────────────────────
    'db:assignments:list': () => {
        try {
            return Promise.resolve(ok(repo.listAssignments()));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to list assignments: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:assignments:get': (id) => {
        try {
            const assignment = repo.getAssignment(id);
            return Promise.resolve(ok(assignment));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to get assignment: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:assignments:upsert': (input) => {
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
        }
        catch (error) {
            return Promise.resolve(err(`Failed to upsert assignment: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:assignments:delete': (id) => {
        try {
            repo.deleteAssignment(id);
            sendEventToRenderers('db:changed', { table: 'assignments', action: 'delete', id });
            return Promise.resolve(ok(undefined));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to delete assignment: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    // ── Database: SubTasks ─────────────────────────────────────────────────
    'db:subtasks:list': (assignmentId) => {
        try {
            return Promise.resolve(ok(repo.listSubTasks(assignmentId)));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to list sub-tasks: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:subtasks:upsert': (input) => {
        try {
            const subTask = repo.upsertSubTask(input);
            // SubTaskInput has no ID, so this is always an insert
            sendEventToRenderers('db:changed', { table: 'sub_tasks', action: 'insert', id: subTask.id });
            return Promise.resolve(ok(subTask));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to upsert sub-task: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:subtasks:delete': (id) => {
        try {
            repo.deleteSubTask(id);
            sendEventToRenderers('db:changed', { table: 'sub_tasks', action: 'delete', id });
            return Promise.resolve(ok(undefined));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to delete sub-task: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:subtasks:toggle': (input) => {
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
        }
        catch (error) {
            return Promise.resolve(err(`Failed to toggle sub-task: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    // ── Database: Notes ────────────────────────────────────────────────────
    'db:notes:list': (assignmentId) => {
        try {
            const note = repo.getNote(assignmentId);
            return Promise.resolve(ok(note ? [note] : []));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to get note: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:notes:upsert': (input) => {
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
        }
        catch (error) {
            return Promise.resolve(err(`Failed to upsert note: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:notes:delete': (assignmentId) => {
        try {
            repo.setNote(assignmentId, '');
            sendEventToRenderers('db:changed', { table: 'notes', action: 'delete', id: assignmentId });
            return Promise.resolve(ok(undefined));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    // ── Database: Priority Order ───────────────────────────────────────────
    'db:priority:list': () => {
        try {
            const ids = repo.getPriorityOrder();
            const orders = ids.map((id, index) => ({
                id: id,
                assignmentId: id,
                order: index,
                updatedAt: new Date().toISOString(),
            }));
            return Promise.resolve(ok(orders));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to get priority order: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:priority:reorder': (ids) => {
        try {
            repo.setPriorityOrder(ids);
            sendEventToRenderers('db:changed', { table: 'priority_order', action: 'reorder', id: '' });
            return Promise.resolve(ok(undefined));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to reorder priority: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    'db:priority:upsert': (input) => {
        try {
            // Check if priority order entry exists to determine insert vs update
            const existingOrder = repo.getPriorityOrder();
            const exists = existingOrder.includes(input.assignmentId);
            const action = exists ? 'update' : 'insert';
            const order = repo.upsertPriorityOrder(input);
            sendEventToRenderers('db:changed', {
                table: 'priority_order',
                action,
                id: input.assignmentId,
            });
            return Promise.resolve(ok(order));
        }
        catch (error) {
            return Promise.resolve(err(`Failed to upsert priority order: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
    },
    // ── iCal Integration ───────────────────────────────────────────────────
    'ical:fetch': async (input) => {
        try {
            // Validate URL
            if (!input.url || typeof input.url !== 'string') {
                return err('URL is required', 'VALIDATION_ERROR');
            }
            try {
                new URL(input.url);
            }
            catch {
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
        }
        catch (error) {
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
    'ical:import': async (input) => {
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
            const result = repo.importAssignments(assignments);
            // Update lastSyncAt in settings on successful import
            const now = new Date().toISOString();
            await repo.setSettings({ lastSyncAt: now });
            // Emit completion progress
            sendEventToRenderers('ical:progress', {
                stage: 'complete',
                progress: 100,
                message: `Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}`,
            });
            return ok(result);
        }
        catch (error) {
            // Emit error progress
            const message = error instanceof Error ? error.message : 'Unknown error';
            sendEventToRenderers('ical:progress', { stage: 'error', progress: 100, message });
            return err(`Failed to import assignments: ${message}`, 'INTERNAL_ERROR');
        }
    },
    // ── Settings ───────────────────────────────────────────────────────────
    'settings:get': async () => {
        try {
            const settings = await repo.getAllSettings();
            return ok(settings);
        }
        catch (error) {
            return err(`Failed to get settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    'settings:set': async (partial) => {
        try {
            const settings = await repo.setSettings(partial);
            sendEventToRenderers('settings:changed', settings);
            return ok(settings);
        }
        catch (error) {
            return err(`Failed to set settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    'settings:reset': async () => {
        try {
            const settings = await repo.resetSettings();
            sendEventToRenderers('settings:changed', settings);
            return ok(settings);
        }
        catch (error) {
            return err(`Failed to reset settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
    // ── App ────────────────────────────────────────────────────────────────
    'app:version': async () => {
        const { app } = await import('electron');
        return ok(app.getVersion());
    },
};
/**
 * Register all IPC handlers with ipcMain.
 * Call this during app initialization (after app.whenReady()).
 */
export function registerIpcHandlers() {
    Object.keys(handlers).forEach((channel) => {
        const handler = handlers[channel];
        ipcMain.handle(channel, async (_event, request) => {
            try {
                // Type-safe handler invocation - handlers are typed by channel
                return await handler(request);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                return { ok: false, error: message, code: 'INTERNAL_ERROR' };
            }
        });
    });
}
//# sourceMappingURL=ipc-handlers.js.map