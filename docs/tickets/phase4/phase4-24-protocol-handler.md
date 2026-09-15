# Ticket: phase4-24-protocol-handler

## Title
**`courseflow://` Protocol**

## Description
Register custom protocol (`courseflow://open?page=...`, `courseflow://sync`). Handle in main process, route to renderer via IPC. NSIS/DMG/AppImage registration.

## Acceptance Criteria
- [ ] Protocol registered: `courseflow://`
- [ ] Supported URLs:
  - `courseflow://open?page=<pageId>` — Open notes page
  - `courseflow://open?assignment=<assignmentId>` — Open assignment detail
  - `courseflow://sync` — Trigger manual sync
  - `courseflow://settings` — Open settings
  - `courseflow://pomodoro` — Open Pomodoro view
- [ ] Main process handles `app.setAsDefaultProtocolClient('courseflow')`
- [ ] Second instance handling: `app.requestSingleInstanceLock()` + protocol args passed to existing window
- [ ] NSIS installer registers protocol (Windows)
- [ ] DMG/AppImage registers protocol (macOS/Linux)
- [ ] Unit tests for URL parsing and routing

## Technical Details

### Main Process Setup (src/backend/main/protocol.ts)
```typescript
import { app, BrowserWindow, protocol } from 'electron';
import { sendToRenderer } from './utils/ipc';

const PROTOCOL = 'courseflow';

export function registerProtocol(): boolean {
  // Register as default protocol client
  const success = app.setAsDefaultProtocolClient(PROTOCOL);
  
  // Handle second instance (Windows/Linux)
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }
  
  app.on('second-instance', (_event, commandLine) => {
    // Focus existing window
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      // Parse protocol URL from command line
      const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`));
      if (url) handleProtocolUrl(mainWindow, url);
    }
  });
  
  // macOS: Handle open-url event
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) handleProtocolUrl(mainWindow, url);
  });
  
  return success;
}

function handleProtocolUrl(window: BrowserWindow, url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname; // '/open', '/sync', etc.
    const params = parsed.searchParams;
    
    switch (pathname) {
      case '/open':
        if (params.has('page')) {
          sendToRenderer(window, 'protocol:open-page', params.get('page'));
        } else if (params.has('assignment')) {
          sendToRenderer(window, 'protocol:open-assignment', params.get('assignment'));
        }
        break;
      case '/sync':
        sendToRenderer(window, 'protocol:sync');
        break;
      case '/settings':
        sendToRenderer(window, 'protocol:open-settings');
        break;
      case '/pomodoro':
        sendToRenderer(window, 'protocol:open-pomodoro');
        break;
      default:
        console.warn(`Unknown protocol path: ${pathname}`);
    }
  } catch (err) {
    console.error('Failed to parse protocol URL:', url, err);
  }
}
```

### NSIS Protocol Registration (electron-builder)
```yaml
# electron-builder.yml
nsis:
  # ... existing config
  include: build/nsis-protocol.nsh
```

**build/nsis-protocol.nsh:**
```nsh
!macro customInstall
  # Register protocol
  WriteRegStr HKCU "Software\Classes\courseflow" "" "URL:CourseFlow Protocol"
  WriteRegStr HKCU "Software\Classes\courseflow" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\courseflow\DefaultIcon" "" "$INSTDIR\CourseFlow.exe,1"
  WriteRegStr HKCU "Software\Classes\courseflow\shell\open\command" "" '"$INSTDIR\CourseFlow.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\courseflow"
!macroend
```

### macOS/Linux Protocol Registration
- **macOS:** Handled automatically by `app.setAsDefaultProtocolClient` + `CFBundleURLTypes` in `Info.plist` (electron-builder does this)
- **Linux:** `.desktop` file with `MimeType=x-scheme-handler/courseflow;` (electron-builder does this)

### Renderer Handler
```typescript
// In App.tsx or routing
useEffect(() => {
  const unsub = window.api.onProtocolAction((action, data) => {
    switch (action) {
      case 'open-page': navigate(`/notes/${data}`); break;
      case 'open-assignment': navigate(`/assignments/${data}`); break;
      case 'sync': triggerSync(); break;
      case 'open-settings': openSettings(); break;
      case 'open-pomodoro': openPomodoro(); break;
    }
  });
  return unsub;
}, []);
```

### Preload Bridge
```typescript
// preload/index.ts
onProtocolAction: (cb) => ipcRenderer.on('protocol:action', (_e, action, data) => cb(action, data)),
```

## Dependencies
- Requires: `phase4-18-electron-builder` (NSIS custom script)
- Requires: `phase4-23-native-menus` — Menu "Open Link" integration

## Testing
- Unit test: `handleProtocolUrl` parses all supported URLs correctly
- Unit test: Invalid URLs handled gracefully
- Manual test (Windows): Install → Run `courseflow://open?page=test` → Opens page
- Manual test (macOS): `open "courseflow://sync"` → Triggers sync
- Manual test: Second instance launches → Focuses existing window + handles URL

## Related
- `phase4-18-electron-builder` — Installer protocol registration
- `phase4-23-native-menus` — Menu integration