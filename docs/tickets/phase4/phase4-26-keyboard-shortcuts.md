# Ticket: phase4-26-keyboard-shortcuts

## Title
**Global Keyboard Shortcuts**

## Description
Register global shortcuts (Electron `globalShortcut`): Cmd/Ctrl+Shift+Space → toggle Pomodoro, Cmd/Ctrl+K → command palette/search. Settings to customize.

## Acceptance Criteria
- [ ] Global shortcuts registered in main process:
  - `CmdOrCtrl+Shift+Space` → Toggle Pomodoro (start/pause)
  - `CmdOrCtrl+K` → Open command palette / search
  - `CmdOrCtrl+Shift+N` → New page (notes)
- [ ] Shortcuts work when app is focused AND when app is in background (global)
- [ ] Settings UI to view/customize shortcuts
- [ ] Shortcuts stored in settings (`keybindings` key)
- [ ] Conflict detection: warn if shortcut conflicts with system/other apps
- [ ] Disable/enable global shortcuts toggle in settings
- [ ] Platform-appropriate modifiers (Cmd on macOS, Ctrl on Windows/Linux)
- [ ] Unit tests for shortcut registration and handling

## Technical Details

### Main Process Registration (src/backend/main/shortcuts.ts)
```typescript
import { globalShortcut, BrowserWindow } from 'electron';

interface ShortcutConfig {
  'toggle-pomodoro': string;      // default: 'CommandOrControl+Shift+Space'
  'open-command-palette': string; // default: 'CommandOrControl+K'
  'new-page': string;             // default: 'CommandOrControl+Shift+N'
  'open-settings': string;        // default: 'CommandOrControl+,'
}

const DEFAULT_SHORTCUTS: ShortcutConfig = {
  'toggle-pomodoro': 'CommandOrControl+Shift+Space',
  'open-command-palette': 'CommandOrControl+K',
  'new-page': 'CommandOrControl+Shift+N',
  'open-settings': 'CommandOrControl+,',
};

let registeredShortcuts: Map<string, string> = new Map(); // action -> accelerator

export function registerGlobalShortcuts(mainWindow: BrowserWindow): void {
  const config = loadShortcutConfig(); // from settings
  
  for (const [action, accelerator] of Object.entries(config)) {
    if (!accelerator) continue;
    
    const success = globalShortcut.register(accelerator, () => {
      handleShortcut(action, mainWindow);
    });
    
    if (success) {
      registeredShortcuts.set(action, accelerator);
    } else {
      console.warn(`Failed to register shortcut: ${accelerator} for ${action}`);
    }
  }
}

function handleShortcut(action: string, window: BrowserWindow) {
  if (!window) return;
  
  switch (action) {
    case 'toggle-pomodoro':
      window.webContents.send('shortcut:toggle-pomodoro');
      break;
    case 'open-command-palette':
      window.webContents.send('shortcut:open-command-palette');
      break;
    case 'new-page':
      window.webContents.send('shortcut:new-page');
      break;
    case 'open-settings':
      window.webContents.send('shortcut:open-settings');
      break;
  }
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
  registeredShortcuts.clear();
}

export function updateShortcut(action: string, newAccelerator: string): boolean {
  const oldAccelerator = registeredShortcuts.get(action);
  if (oldAccelerator) globalShortcut.unregister(oldAccelerator);
  
  const success = globalShortcut.register(newAccelerator, () => {
    const window = BrowserWindow.getAllWindows()[0];
    handleShortcut(action, window);
  });
  
  if (success) {
    registeredShortcuts.set(action, newAccelerator);
    saveShortcutConfig({ ...loadShortcutConfig(), [action]: newAccelerator });
  }
  return success;
}
```

### Settings Storage
```typescript
// settings key = 'keybindings'
{
  'toggle-pomodoro': 'CommandOrControl+Shift+Space',
  'open-command-palette': 'CommandOrControl+K',
  'new-page': 'CommandOrControl+Shift+N',
  'open-settings': 'CommandOrControl+,',
  globalShortcutsEnabled: true
}
```

### Settings UI
```tsx
// components/settings/KeyboardShortcuts.tsx
export function KeyboardShortcutsSettings() {
  const { keybindings, updateKeybinding, globalShortcutsEnabled, setGlobalShortcutsEnabled } = useSettingsStore();
  
  return (
    <section className="settings-section">
      <h3>Keyboard Shortcuts</h3>
      <Toggle 
        label="Enable Global Shortcuts" 
        checked={globalShortcutsEnabled}
        onChange={setGlobalShortcutsEnabled}
        description="Shortcuts work even when CourseFlow is not focused"
      />
      
      <ShortcutRecorder
        action="toggle-pomodoro"
        label="Toggle Pomodoro"
        current={keybindings['toggle-pomodoro']}
        onChange={updateKeybinding}
      />
      <ShortcutRecorder
        action="open-command-palette"
        label="Open Command Palette"
        current={keybindings['open-command-palette']}
        onChange={updateKeybinding}
      />
      <ShortcutRecorder
        action="new-page"
        label="New Page"
        current={keybindings['new-page']}
        onChange={updateKeybinding}
      />
      <ShortcutRecorder
        action="open-settings"
        label="Open Settings"
        current={keybindings['open-settings']}
        onChange={updateKeybinding}
      />
    </section>
  );
}

// ShortcutRecorder: Click to record, press keys, validates no conflicts
```

### ShortcutRecorder Component
```tsx
function ShortcutRecorder({ action, label, current, onChange }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!recording) return;
      e.preventDefault();
      
      const parts = [];
      if (e.metaKey || e.ctrlKey) parts.push(navigator.platform.includes('Mac') ? 'Command' : 'Control');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift' && e.key !== 'Meta') {
        parts.push(e.key.toUpperCase());
      }
      
      const accelerator = parts.join('+');
      
      // Validate
      if (parts.length < 2) {
        setError('Shortcut must include a modifier (Cmd/Ctrl, Alt, Shift)');
        return;
      }
      
      // Check conflicts (simplified)
      const conflicts = checkSystemConflicts(accelerator);
      if (conflicts) {
        setError(`Conflicts with system: ${conflicts}`);
        return;
      }
      
      onChange(action, accelerator);
      setRecording(false);
      setError(null);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recording]);
  
  return (
    <div className="shortcut-recorder">
      <span className="shortcut-recorder__label">{label}</span>
      <button
        className={recording ? 'recording' : ''}
        onClick={() => setRecording(true)}
        aria-label={recording ? 'Press shortcut keys...' : `Current: ${current}`}
      >
        {recording ? 'Press keys...' : current || 'Not set'}
      </button>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
```

## Dependencies
- Requires: `phase4-11-pomodoro-store` (Pomodoro toggle action)
- Requires: `phase4-16-graph-ui` / Phase 3 — Command palette (ticket 3.14)
- Requires: Settings store/IPC

## Testing
- Unit test: `registerGlobalShortcuts` registers all defaults
- Unit test: `updateShortcut` unregisters old, registers new
- Unit test: Shortcut handler sends correct IPC
- Manual test: Global shortcut works when app minimized
- Manual test: Shortcut works when app not focused
- Manual test: Conflict detection warns appropriately

## Related
- `phase4-11-pomodoro-store` — Pomodoro toggle
- `phase4-25-onboarding` — Show shortcuts in onboarding
- `docs/architecture/accessibility.md` — Shortcut discoverability