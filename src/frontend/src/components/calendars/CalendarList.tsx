/**
 * CalendarList — Calendar Sources List Component
 *
 * Renders a list of calendar sources with drag-and-drop reordering,
 * enable/disable toggle, and delete action. Integrates with calendarsStore
 * for optimistic updates.
 *
 * @module @frontend/components/calendars/CalendarList
 */

import type { CalendarSource, IpcEvents } from '@backend/shared/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';
import React, { useCallback, useEffect } from 'react';

import { useToast } from '../../context/ToastContext';
import { useCalendarsStore } from '../../stores/calendarsStore';

import './CalendarList.css';

/**
 * CalendarRow — Single calendar row with drag handle, name, color badge, toggle, last sync, error, delete.
 */
interface CalendarRowProps {
  calendar: CalendarSource;
  onDelete: (id: string, name: string) => void;
}

function CalendarRow({ calendar, onDelete }: CalendarRowProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sortableIsDragging } = useSortable({
    id: calendar.id,
  });

  const { setEnabledOptimistic } = useCalendarsStore();
  const { error: toastError, success: toastSuccess } = useToast();

  const handleToggle = useCallback(async () => {
    try {
      await setEnabledOptimistic(calendar.id, !calendar.enabled);
      toastSuccess(calendar.enabled ? 'Calendar disabled' : 'Calendar enabled');
    } catch {
      toastError('Failed to toggle calendar');
    }
  }, [calendar.id, calendar.enabled, setEnabledOptimistic, toastError, toastSuccess]);

  const handleToggleChange = useCallback(() => {
    void handleToggle();
  }, [handleToggle]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sortableIsDragging ? 0.5 : 1,
  };

  const isDisabled = !calendar.enabled;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`calendar-row ${sortableIsDragging ? 'calendar-row--dragging' : ''} ${isDisabled ? 'calendar-row--disabled' : ''}`}
      data-testid={`calendar-row-${calendar.id}`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="calendar-row__drag-handle"
        aria-label="Drag to reorder"
        type="button"
        tabIndex={-1}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M5 9l-3 3 3 3M5 15l-3 3 3 3M12 9l-3 3 3 3M12 15l-3 3 3 3M19 9l-3 3 3 3M19 15l-3 3 3 3" />
        </svg>
      </button>

      {/* Color Badge */}
      <div className="calendar-row__color-badge" style={{ backgroundColor: calendar.color }} aria-hidden="true" />

      {/* Name & Status */}
      <div className="calendar-row__info">
        <span className="calendar-row__name">{calendar.name}</span>
        <div className="calendar-row__meta">
          <span className={`calendar-row__status ${calendar.enabled ? 'calendar-row__status--enabled' : 'calendar-row__status--disabled'}`}>
            {calendar.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <span className="calendar-row__last-sync">Last sync: {formatLastSync(calendar.lastSyncAt)}</span>
          {calendar.lastError && (
            <span className="calendar-row__error" title={calendar.lastError}>
              Error: {calendar.lastError}
            </span>
          )}
        </div>
      </div>

      {/* Enabled Toggle */}
      <label className="calendar-row__toggle" htmlFor={`cal-toggle-${calendar.id}`}>
        <input
          id={`cal-toggle-${calendar.id}`}
          type="checkbox"
          checked={calendar.enabled}
          onChange={handleToggleChange}
          className="calendar-row__toggle-input"
          aria-label={`${calendar.enabled ? 'Disable' : 'Enable'} ${calendar.name}`}
        />
        <span className="calendar-row__toggle-slider" />
      </label>

      {/* Delete Button */}
      <button
        className="calendar-row__delete"
        onClick={() => {
          onDelete(calendar.id, calendar.name);
        }}
        aria-label={`Delete ${calendar.name}`}
        type="button"
        title="Delete calendar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Format last sync time for display.
 */
function formatLastSync(isoString: string | null): string {
  if (!isoString) return 'Never synced';
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

/**
 * CalendarRowSkeleton — Loading skeleton for a calendar row.
 */
function CalendarRowSkeleton(): React.ReactElement {
  return (
    <div className="calendar-row calendar-row--skeleton" aria-hidden="true">
      <div className="calendar-row__drag-handle skeleton" />
      <div className="calendar-row__color-badge skeleton" />
      <div className="calendar-row__info">
        <div className="calendar-row__name skeleton" />
        <div className="calendar-row__meta">
          <div className="calendar-row__status skeleton" />
          <div className="calendar-row__last-sync skeleton" />
        </div>
      </div>
      <div className="calendar-row__toggle skeleton" />
      <div className="calendar-row__delete skeleton" />
    </div>
  );
}

/**
 * CalendarList — Main calendar list component with DnD support.
 */
export function CalendarList({
  onAddCalendar,
  onDeleteCalendar,
}: {
  onAddCalendar: () => void;
  onDeleteCalendar: (id: string, name: string) => void;
}): React.ReactElement {
  const { calendars, isLoading, error, fetchCalendars, optimisticReorder } = useCalendarsStore();

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = calendars.findIndex((c) => c.id === active.id);
        const newIndex = calendars.findIndex((c) => c.id === over.id);
        const newCalendars = arrayMove(calendars, oldIndex, newIndex);
        const orderedIds = newCalendars.map((c) => c.id);
        optimisticReorder(orderedIds);
      }
    },
    [calendars, optimisticReorder]
  );

  // Fetch on mount
  useEffect(() => {
    if (calendars.length === 0 && !isLoading) {
      void fetchCalendars();
    }
  }, [calendars.length, isLoading, fetchCalendars]);

  // Handle external db:changed events
  useEffect(() => {
    const unsubscribe = window.api.onDbChanged((payload: IpcEvents['db:changed']) => {
      if (payload.table === 'calendars') {
        useCalendarsStore.getState().handleDbChanged(payload);
      }
    });
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="calendar-list" role="list" aria-label="Calendars">
        {[0, 1, 2].map((i) => (
          <CalendarRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-list__error" role="alert">
        <p>Failed to load calendars: {error}</p>
        <button className="secondary" onClick={() => void fetchCalendars()} type="button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={calendars.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="calendar-list" role="list" aria-label="Calendars">
          {calendars.length === 0 ? (
            <div className="calendar-list__empty">
              <p>No calendars configured yet.</p>
              <button className="primary" onClick={onAddCalendar} type="button">
                Add Calendar
              </button>
            </div>
          ) : (
            calendars.map((calendar) => (
              <CalendarRow key={calendar.id} calendar={calendar} onDelete={onDeleteCalendar} />
            ))
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}