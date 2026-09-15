# Ticket: phase4-13-pomodoro-notifications

## Title
**Notifications & Sounds**

## Description
Desktop notification (Electron `Notification` API) on phase complete. Optional sound (bundled `.wav`). Respect `doNotDisturb` / focus assist. Settings: enable/disable notifications, sound, auto-start breaks.

## Acceptance Criteria
- [ ] Desktop notification shown when phase completes (work → break, break → work)
- [ ] Notification title: "Pomodoro", body: "Work session complete! Time for a break." (or vice versa)
- [ ] Notification clicks: focus app window
- [ ] Sound played on phase complete (configurable, default enabled)
- [ ] Sound file: bundled `.wav` (subtle, ~1s) or Web Audio API oscillator
- [ ] Respects OS Do Not Disturb / Focus Assist (Electron `Notification` handles this)
- [ ] Settings toggles: `notificationsEnabled`, `soundEnabled` (in `PomodoroConfig`)
- [ ] Sound volume respects system volume (no separate volume control)
- [ ] Unit tests for notification/sound triggering

## Technical Details

### Notification Trigger (in store `_completePhase`)
```typescript
import { Notification } from 'electron'; // Only in main! Use IPC to trigger from renderer.

// Option A: Renderer uses Notification API directly (if contextIsolation allows)
// Option B: IPC to main: `pomodoro:notify` → main shows Notification
// Option C: Preload exposes `window.api.pomodoro.notify()`

// Recommended: Option B - main process shows notifications (more reliable)
```

### IPC for Notifications (if needed)
```typescript
// In ipc-handlers.ts (main)
ipcMain.handle('pomodoro:notify', (_event, payload: { title: string; body: string }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({ title: payload.title, body: payload.body });
    notification.onclick = () => {
      mainWindow?.show();
      mainWindow?.focus();
    };
  }
  return { ok: true };
});
```

### Preload Bridge
```typescript
// In preload/index.ts
pomodoro: {
  notify: (payload: { title: string; body: string }) => ipcRenderer.invoke('pomodoro:notify', payload),
  playSound: () => ipcRenderer.invoke('pomodoro:play-sound'),
}
```

### Sound Implementation
**Option 1: Bundled WAV (recommended)**
- Add `assets/sounds/pomodoro-complete.wav` (~1s, subtle)
- Copy to `dist/` via `electron.vite.config.ts` or `electron-builder` resources
- In main: `new Audio(path.join(__dirname, '../assets/sounds/pomodoro-complete.wav')).play()`

**Option 2: Web Audio API (no file needed)**
```typescript
function playCompletionSound() {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
  osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
  osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.8);
}
```

### Do Not Disturb Handling
- Electron `Notification` API automatically respects macOS Do Not Disturb / Windows Focus Assist
- No additional code needed
- Test: Enable DND, trigger notification → should not appear (or appear silently)

### Settings Integration
- Already in `PomodoroConfig` from ticket 4.10:
  - `notificationsEnabled: boolean`
  - `soundEnabled: boolean`
- Store checks config before triggering

## Dependencies
- Requires: `phase4-11-pomodoro-store` (store triggers notifications)
- Requires: Electron `Notification` API (main process)

## Testing
- Unit test: Notification triggered on phase complete (mock `Notification`)
- Unit test: Sound played when enabled, not played when disabled
- Unit test: Config toggles respected
- Manual test: Enable macOS DND / Windows Focus Assist → notifications suppressed

## Related
- `phase4-11-pomodoro-store` — Store triggers
- `phase4-10-pomodoro-types` — Config types
- `phase4-12-pomodoro-ui` — Config UI