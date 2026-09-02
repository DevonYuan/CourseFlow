/**
 * Event Emitter — Main Process
 *
 * Sends one-way events to all renderer windows.
 * Used for db:changed, ical:progress, settings:changed notifications.
 *
 * @module @backend/main/events
 */
import type { IpcEvents } from '../shared/ipc.js';
/**
 * Send a one-way event to all renderer windows.
 * Used for db:changed, ical:progress, settings:changed notifications.
 *
 * @param channel - Event channel name
 * @param payload - Event payload
 */
export declare function sendEventToRenderers<E extends keyof IpcEvents>(channel: E, payload: IpcEvents[E]): void;
//# sourceMappingURL=events.d.ts.map