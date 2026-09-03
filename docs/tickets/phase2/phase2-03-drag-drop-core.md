---
applyTo: 'docs/tickets/phase*/**.md'
issue: 'N/A'
---

# Ticket: phase2-03-drag-drop-core

**Phase:** 2 — Priority & Organization  
**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 1.5 days

---

## Description

Implement drag-and-drop reordering in the `AssignmentList` component using `@dnd-kit/core`. Optimistic UI updates: local Zustand store updates immediately on drop, then `db:priority:reorder` IPC call persists the new order.

---

## Requirements

### Functional

- [ ] Wrap `AssignmentList` with `<DndContext>` from `@dnd-kit/core`
- [ ] Each assignment row is a `<SortableItem>` with drag handle (grip icon)
- [ ] On drag end: compute new ordered assignment IDs → update Zustand store immediately → call `window.api.db.priority.reorder(ids)`
- [ ] Visual feedback during drag: opacity, shadow, placeholder/gap indicator
- [ ] Disable drag for completed assignments (optional: allow but visually distinct)
- [ ] Touch support for touchscreen devices
- [ ] Screen reader announcements: "Moved [title] to position [n]"

### Non-Functional

- [ ] Zero `any` in implementation
- [ ] Optimistic update: UI reflects new order before server confirms
- [ ] Rollback on IPC error: toast "Failed to save order" + revert to previous order
- [ ] Debounce rapid reorders (user drags multiple items quickly) — 300ms
- [ ] Performance: virtualized list not required (<500 items), but avoid unnecessary re-renders
- [ ] Accessibility: `@dnd-kit` keyboard support enabled by default (Space to pick up, arrows to move, Enter to drop)

---

## Designs & Constraints

- **Library**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (already added in non-coding actions)
- **State**: Zustand store holds `assignments: Assignment[]` and `priorityOrder: string[]` (ordered IDs)
- **Drag handle**: Grip icon (`⋮⋮`) on left of each row — only this area initiates drag
- **Sortable strategy**: `verticalListSortingStrategy` from `@dnd-kit/sortable`
- **Collision detection**: `closestCenter` from `@dnd-kit/core`
- **Sensors**: `PointerSensor` (mouse/touch) + `KeyboardSensor` (accessibility)

### Zustand Store Updates (in `src/frontend/src/store/useAssignmentStore.ts`)

```typescript
// Add to store
priorityOrder: string[]  // ordered assignment IDs
setPriorityOrder: (ids: string[]) => void
reorderOptimistic: (ids: string[]) => void  // immediate update
revertPriorityOrder: () => void  // rollback on error
```

### Component Structure

```tsx
<DndContext
  sensors={[PointerSensor, KeyboardSensor]}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext items={priorityOrder} strategy={verticalListSortingStrategy}>
    {assignments.map(assignment => (
      <SortableItem key={assignment.id} id={assignment.id}>
        {({ attributes, listeners, setNodeRef, isDragging }) => (
          <AssignmentRow
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            assignment={assignment}
            isDragging={isDragging}
          />
        )}
      </SortableItem>
    ))}
  </SortableContext>
</DndContext>
```

---

## Code Changes

### New Files

- `src/frontend/src/components/AssignmentList/DragHandle.tsx` — reusable drag handle
- `src/frontend/src/components/AssignmentList/DragOverlay.tsx` — custom drag overlay (optional)

### Modified Files

- `src/frontend/src/store/useAssignmentStore.ts` — add priorityOrder state + actions
- `src/frontend/src/components/AssignmentList/AssignmentList.tsx` — wrap with DndContext, implement `handleDragEnd`
- `src/frontend/src/components/AssignmentList/AssignmentRow.tsx` — add drag handle, `isDragging` styles

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Drag handle initiates drag; row follows cursor | Manual test |
| 2 | Drop reorders list visually (optimistic) | Manual test |
| 3 | `window.api.db.priority.reorder` called with correct ordered IDs | Network tab / IPC spy |
| 4 | Rollback on IPC error + toast shown | Manual test (mock error) |
| 5 | Keyboard: Space → arrows → Enter reorders correctly | Manual test + screen reader |
| 6 | Touch drag works on touchscreen | Manual test |
| 7 | Completed assignments: drag disabled or visually distinct | Manual test |
| 8 | All tests pass (`pnpm test`) | CI run |

---

## Notes

- `@dnd-kit` is headless — brings own styles; customize via CSS classes
- Drag overlay: use `@dnd-kit/utilities` `CSS.Transform` for smooth animation
- Debounce: store `pendingReorder` timeout; cancel previous on new drag end
- Rollback: store `previousPriorityOrder` before optimistic update
- Completed assignments: add `data-draggable="false"` or conditional `SortableItem` wrapper
- This component integrates with filter/sort/group from tickets 2.6–2.12 — `priorityOrder` reflects *filtered* view order

---

## Release Summary

Implement drag-and-drop assignment reordering with @dnd-kit and optimistic updates