/**
 * Event Emitter — Main Process
 *
 * Sends one-way events to all renderer windows.
 * Used for db:changed, ical:progress, settings:changed, scheduler notifications.
 *
 * @module @backend/main/events
 */

import { BrowserWindow } from 'electron';

import type { IpcEvents } from '../shared/ipc.js';

/**
 * Send a one-way event to all renderer windows.
 * Used for db:changed, ical:progress, settings:changed notifications.
 *
 * @param channel - Event channel name
 * @param payload - Event payload
 */
export function sendEventToRenderers<E extends keyof IpcEvents>(
  channel: E,
  payload: IpcEvents[E],
): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}

/**
 * Emit scheduler:tick event to all renderer windows.
 * Called when the scheduler's nextRun time updates.
 *
 * @param nextRun - ISO timestamp of the next scheduled run
 */
export function emitSchedulerTick(nextRun: string): void {
  sendEventToRenderers('scheduler:tick', { nextRun });
}

/**
 * Emit scheduler:error event to all renderer windows.
 * Called when the scheduler encounters an error during fetch/import.
 *
 * @param message - Error message
 * @param code - Error code category
 */
export function emitSchedulerError(message: string, code: 'network' | 'auth' | 'parse' | 'unknown'): void {
  sendEventToRenderers('scheduler:error', { message, code });
}
