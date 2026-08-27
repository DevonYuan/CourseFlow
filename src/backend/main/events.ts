/**
 * Event Emitter — Main Process
 *
 * Sends one-way events to all renderer windows.
 * Used for db:changed, ical:progress, settings:changed notifications.
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
