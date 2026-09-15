# Ticket: phase4-03-calendars-preload

## Title
**Preload Bridge for Calendars**

## Description
Extend `src/backend/preload/index.ts` with `window.api.db.calendars.*` typed API.

## Acceptance Criteria
- [ ] `window.api.db.calendars` object exposed with all 7 methods
- [ ] TypeScript types match `IpcChannels` from `src/backend/shared/ipc.ts`
- [ ] Methods return `Promise<IpcResult<T>>` matching handler responses
- [ ] No business logic in preload — pure IPC wrapper
- [ ] TypeScript compiles without errors

## Technical Details

### Preload API Shape
```typescript
// In contextBridge.exposeInMainWorld('api', { ... })
db: {
  calendars: {
    list: () => ipcRenderer.invoke('db:calendars:list'),
    get: (id: string) => ipcRenderer.invoke('db:calendars:get', id),
    create: (input: CalendarSourceInput) => ipcRenderer.invoke('db:calendars:create', input),
    update: (id: string, input: CalendarSourceUpdateInput) => ipcRenderer.invoke('db:calendars:update', id, input),
    delete: (id: string) => ipcRenderer.invoke('db:calendars:delete', id),
    reorder: (ids: string[]) => ipcRenderer.invoke('db:calendars:reorder', ids),
    setEnabled: (id: string, enabled: boolean) => ipcRenderer.invoke('db:calendars:setEnabled', { id, enabled }),
  },
  // ... existing db APIs
}
```

### TypeScript Declaration
- Ensure `src/backend/shared/ipc.ts` exports `CalendarSource`, `CalendarSourceInput`, `CalendarSourceUpdateInput`
- Preload imports types from `@backend/shared/ipc` (or `@shared/ipc` via path alias)
- Renderer gets full type inference via `window.api.db.calendars.list()` etc.

## Dependencies
- Requires: `phase4-02-calendars-ipc` (handlers registered)
- Requires: `phase4-00-data-model-update` (IPC channel types defined)

## Testing
- TypeScript compile check: `pnpm typecheck` passes
- Manual test: Open dev tools, run `window.api.db.calendars.list()` → returns `IpcResult<CalendarSource[]>`

## Related
- `phase4-02-calendars-ipc` — IPC handlers
- `src/backend/preload/index.ts` — Preload script
- `src/backend/shared/ipc.ts` — Channel definitions