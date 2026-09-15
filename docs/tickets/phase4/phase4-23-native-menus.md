# Ticket: phase4-23-native-menus

## Title
**Native Application Menus**

## Description
Implement `Menu.buildFromTemplate` in main: File, Edit, View, Window, Help. Keyboard shortcuts (Cmd/Ctrl+N, ,, Q, etc.). Context menus for assignment list, notes sidebar.

## Acceptance Criteria
- [ ] Main menu bar implemented in `src/backend/main/menu.ts`
- [ ] Menus: File, Edit, View, Window, Help (macOS) / File, Edit, View, Help (Windows/Linux)
- [ ] Standard shortcuts work: Cmd/Ctrl+N (new page), Cmd/Ctrl+, (settings), Cmd/Ctrl+Q (quit), Cmd/Ctrl+W (close window)
- [ ] Context menu on assignment list: Open, Mark Complete, Delete, Copy Link
- [ ] Context menu on notes sidebar: New Page, New Folder, Rename, Delete, Duplicate
- [ ] Menu items update dynamically (enabled/disabled based on selection)
- [ ] macOS: App menu (About, Preferences, Quit) handled correctly
- [ ] Windows/Linux: File menu contains Quit
- [ ] Unit tests for menu template structure

## Technical Details

### Main Menu Template (src/backend/main/menu.ts)
```typescript
import { Menu, MenuItem, shell, app, BrowserWindow } from 'electron';
import { isMac } from './utils/platform';

export function createApplicationMenu(mainWindow: BrowserWindow): Menu {
  const template: (Electron.MenuItemConstructorOptions | MenuItem)[] = [
    // File
    {
      label: 'File',
      submenu: [
        {
          label: 'New Page',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu:new-page'),
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow.webContents.send('menu:open-settings'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Edit
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    // View
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Window
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }] : []),
      ],
    },
    // Help
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/courseflow/courseflow/docs'),
        },
        {
          label: 'Report Issue',
          click: () => shell.openExternal('https://github.com/courseflow/courseflow/issues'),
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => mainWindow.webContents.send('menu:show-shortcuts'),
        },
        { type: 'separator' },
        {
          label: 'About CourseFlow',
          click: () => mainWindow.webContents.send('menu:show-about'),
        },
      ],
    },
  ];
  
  // macOS: Add app menu at start
  if (isMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'Cmd+,', click: () => mainWindow.webContents.send('menu:open-settings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  return menu;
}
```

### Context Menus
```typescript
// Assignment list context menu
export function createAssignmentContextMenu(assignment: Assignment): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => sendToRenderer('assignment:open', assignment.id),
    },
    {
      label: assignment.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete',
      click: () => sendToRenderer('assignment:toggle-complete', assignment.id),
    },
    { type: 'separator' },
    {
      label: 'Copy Link',
      click: () => sendToRenderer('assignment:copy-link', assignment.id),
    },
    {
      label: 'Delete',
      click: () => sendToRenderer('assignment:delete', assignment.id),
    },
  ]);
}

// Notes sidebar context menu
export function createNotesContextMenu(page: Page | null, isFolder: boolean): Menu {
  return Menu.buildFromTemplate([
    {
      label: isFolder ? 'New Subpage' : 'New Page',
      click: () => sendToRenderer('notes:new-page', page?.id),
    },
    {
      label: 'New Folder',
      click: () => sendToRenderer('notes:new-folder', page?.id),
    },
    { type: 'separator' },
    {
      label: 'Rename',
      enabled: !!page,
      click: () => sendToRenderer('notes:rename', page?.id),
    },
    {
      label: 'Duplicate',
      enabled: !!page,
      click: () => sendToRenderer('notes:duplicate', page?.id),
    },
    {
      label: 'Delete',
      enabled: !!page,
      click: () => sendToRenderer('notes:delete', page?.id),
    },
  ]);
}
```

### Renderer Integration
```typescript
// Preload bridge
contextBridge.exposeInMainWorld('api', {
  // ... existing
  onMenuAction: (cb) => ipcRenderer.on('menu:action', (_e, action, data) => cb(action, data)),
});

// In main: sendToRenderer('menu:action', 'new-page', null);

// Renderer hook
export function useMenuActions() {
  useEffect(() => {
    const unsub = window.api.onMenuAction((action, data) => {
      switch (action) {
        case 'new-page': navigate('/notes/new'); break;
        case 'open-settings': openSettings(); break;
        case 'assignment:open': openAssignment(data); break;
        // ...
      }
    });
    return unsub;
  }, []);
}
```

### Dynamic Menu Updates
```typescript
// Update menu item enabled state based on selection
function updateMenuForSelection(selection: Assignment | Page | null) {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;
  
  const editMenu = menu.getMenuItemById('edit');
  if (editMenu) {
    editMenu.submenu?.items.forEach(item => {
      if (item.id === 'copy') item.enabled = !!selection;
      if (item.id === 'delete') item.enabled = !!selection;
    });
  }
}
```

## Dependencies
- Requires: Electron `Menu`, `MenuItem`, `shell`, `app`
- Requires: Renderer IPC handlers for menu actions

## Testing
- Unit test: Menu template builds without errors
- Unit test: macOS template includes app menu
- Unit test: Windows template has Quit in File menu
- Manual test: All shortcuts work
- Manual test: Context menus appear on right-click
- Manual test: Menu items enable/disable correctly

## Related
- `phase4-12-pomodoro-ui` — Pomodoro in menu?
- `phase4-24-protocol-handler` — Menu "Open Link" handling