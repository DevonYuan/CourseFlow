/**
 * Event Emitter — Main Process
 *
 * Sends one-way events to all renderer windows.
 * Used for db:changed, ical:progress, settings:changed notifications.
 *
 * @module @backend/main/events
 */
import { BrowserWindow } from 'electron';
/**
 * Send a one-way event to all renderer windows.
 * Used for db:changed, ical:progress, settings:changed notifications.
 *
 * @param channel - Event channel name
 * @param payload - Event payload
 */
export function sendEventToRenderers(channel, payload) {
    for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
            window.webContents.send(channel, payload);
        }
    }
}
//# sourceMappingURL=events.js.map