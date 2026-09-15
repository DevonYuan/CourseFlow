# Ticket: phase4-19-auto-updater

## Title
**Auto-Updater Integration**

## Description
Add `electron-updater`. Configure update server (GitHub Releases or custom). Check on startup, background download, prompt to install. Handle `autoUpdater` events in main, expose to renderer for UI.

## Acceptance Criteria
- [ ] `electron-updater` installed as dependency
- [ ] Main process: `autoUpdater` configured with GitHub Releases provider
- [ ] Check for updates on app startup (after window ready)
- [ ] Background download of update
- [ ] Prompt user to install when ready (restart required)
- [ ] UI in Settings/About: current version, check for updates button, update status
- [ ] Events exposed to renderer: `update-available`, `update-downloaded`, `update-error`, `checking-for-update`
- [ ] Handle `autoUpdater` events: `logger`, `error`, `checking-for-update`, `update-available`, `update-not-available`, `update-downloaded`
- [ ] Silent background check (no UI) + manual check (with UI)
- [ ] Unit tests for update flow (mock GitHub API)

## Technical Details

### Main Process Setup (src/backend/main/updater.ts)
```typescript
import { autoUpdater } from 'electron-updater';
import { app, dialog, BrowserWindow } from 'electron';
import log from 'electron-log';

autoUpdater.logger = log;
autoUpdater.autoDownload = true;  // Download in background
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(window: BrowserWindow) {
  mainWindow = window;
  
  // Configure GitHub provider
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'courseflow',
    repo: 'courseflow',
    private: false,  // or true with token
  });
  
  // Event handlers
  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('updater:checking');
  });
  
  autoUpdater.on('update-available', (info) => {
    sendToRenderer('updater:available', { version: info.version, releaseNotes: info.releaseNotes });
  });
  
  autoUpdater.on('update-not-available', (info) => {
    sendToRenderer('updater:not-available', { version: info.version });
  });
  
  autoUpdater.on('error', (err) => {
    sendToRenderer('updater:error', { message: err.message });
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('updater:downloaded', { version: info.version, releaseDate: info.releaseDate });
    // Show prompt to restart
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded. Restart to install?`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });
  
  // Check on startup (after 30s to avoid slowing launch)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => log.error('Auto-update check failed:', err));
  }, 30000);
}

function sendToRenderer(channel: string, data?: any) {
  mainWindow?.webContents.send(channel, data);
}
```

### IPC for Manual Check
```typescript
// In ipc-handlers.ts
ipcMain.handle('updater:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, data: { updateInfo: result?.updateInfo } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});
```

### Preload Bridge
```typescript
// preload/index.ts
updater: {
  check: () => ipcRenderer.invoke('updater:check'),
  install: () => ipcRenderer.invoke('updater:install'),
  onChecking: (cb) => ipcRenderer.on('updater:checking', cb),
  onAvailable: (cb) => ipcRenderer.on('updater:available', cb),
  onNotAvailable: (cb) => ipcRenderer.on('updater:not-available', cb),
  onDownloaded: (cb) => ipcRenderer.on('updater:downloaded', cb),
  onError: (cb) => ipcRenderer.on('updater:error', cb),
}
```

### Renderer UI (Settings/About)
```tsx
// components/settings/UpdaterStatus.tsx
function UpdaterStatus() {
  const [status, setStatus] = useState<'checking' | 'available' | 'none' | 'downloaded' | 'error'>('none');
  const [info, setInfo] = useState<any>(null);
  
  useEffect(() => {
    const unsub = [
      window.api.updater.onChecking(() => setStatus('checking')),
      window.api.updater.onAvailable((data) => { setStatus('available'); setInfo(data); }),
      window.api.updater.onNotAvailable(() => setStatus('none')),
      window.api.updater.onDownloaded((data) => { setStatus('downloaded'); setInfo(data); }),
      window.api.updater.onError((data) => { setStatus('error'); setInfo(data); }),
    ];
    return () => unsub.forEach(u => u());
  }, []);
  
  const handleCheck = async () => {
    await window.api.updater.check();
  };
  
  const handleInstall = async () => {
    await window.api.updater.install();
  };
  
  return (
    <div className="updater-status">
      <div>Current: {appVersion}</div>
      {status === 'checking' && <Spinner />}
      {status === 'available' && <Alert>Update available: {info.version} <Button onClick={handleCheck}>Download</Button></Alert>}
      {status === 'downloaded' && <Alert>Ready to install: {info.version} <Button onClick={handleInstall}>Restart & Install</Button></Alert>}
      {status === 'none' && <span>Up to date</span>}
      {status === 'error' && <span className="error">Error: {info.message}</span>}
      <Button onClick={handleCheck} disabled={status === 'checking'}>Check for Updates</Button>
    </div>
  );
}
```

### GitHub Releases Setup
- Create releases with tag `v${version}` (e.g., `v0.4.0`)
- Assets: `CourseFlow-0.4.0.dmg`, `CourseFlow-0.4.0.exe`, `CourseFlow-0.4.0.AppImage`
- Release notes: Generated from conventional commits (ticket 4.21)

## Dependencies
- Requires: `phase4-18-electron-builder` (publish config)
- Requires: `pnpm add electron-updater electron-log`

## Testing
- Unit test: `initAutoUpdater` registers event handlers
- Unit test: `checkForUpdates` calls GitHub API
- Manual test: Publish pre-release, verify update detected
- Manual test: Download update, verify prompt appears

## Related
- `phase4-18-electron-builder` — Publish config
- `phase4-21-ci-release` — Automated release publishing
- `phase4-20-code-signing` — Required for macOS notarization