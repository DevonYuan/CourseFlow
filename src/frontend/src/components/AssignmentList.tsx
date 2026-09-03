/**
 * AssignmentList — Main Assignment List Component
 *
 * Displays assignments with loading skeleton, empty state, and error handling.
 * Uses Zustand store for state management and react-window for virtualization.
 * Implements drag-and-drop reordering with @dnd-kit.
 *
 * @module @frontend/components/AssignmentList
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { List } from 'react-window';
import { AssignmentListSkeleton } from './AssignmentListSkeleton';
import { EmptyState } from './EmptyState';
import { AssignmentRow } from './AssignmentRow';
import { AssignmentListDragDrop } from './AssignmentList/AssignmentListDragDrop';
import { DragOverlay as CustomDragOverlay } from './AssignmentList/DragOverlay';
import { PriorityLiveRegion } from './AssignmentList/PriorityLiveRegion';
import {
  useAssignmentsStore,
  useAssignments,
  useAssignmentsLoading,
  useAssignmentsError,
  useAssignmentsEmpty,
  usePriorityOrder,
  useSetPriorityOrder,
  useReorderOptimistic,
  useRevertPriorityOrder,
  initializeAssignmentsStore,
} from '../store/assignmentsStore';
import type { Assignment } from '@backend/shared/types';
import { useAssignments as useAssignmentsHook } from '../hooks/useAssignments';
import { useToast } from '../context/ToastContext';
import { debounce } from '../utils/debounce';
import { usePriorityKeyboard } from '../hooks/usePriorityKeyboard';
import './AssignmentList.css';

// Virtualization threshold - use virtualized list when > 100 items
const VIRTUALIZATION_THRESHOLD = 100;
// Estimated row height for virtualization
const ROW_HEIGHT = 72;
// Debounce time for rapid reorders (ms)
const REORDER_DEBOUNCE_MS = 300;

interface AssignmentListProps {
  /** Callback fired when user clicks "Open Settings" from empty state */
  onOpenSettings: () => void;
  /** Optional callback when an assignment is clicked */
  onAssignmentClick?: (assignment: Assignment) => void;
}

/**
 * Row renderer for react-window FixedSizeList.
 * Note: Virtualized list doesn't support drag-and-drop, so this is used only
 * when there are > 100 items (drag-and-drop disabled for virtualized lists).
 */
function AssignmentRowRenderer(
  props: {
    index: number;
    style: React.CSSProperties;
    ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
    assignments: Assignment[];
    onClick?: (assignment: Assignment) => void;
    onMarkComplete?: (id: string) => Promise<void>;
  }
): React.ReactElement | null {
  const { index, style, assignments, onClick, onMarkComplete, ...rest } = props;
  const assignment = assignments[index];
  if (!assignment) {
    return <div style={style} {...rest} />;
  }
  return (
    <div style={style} {...rest} data-assignment-id={assignment.id}>
      <AssignmentRow assignment={assignment} onClick={onClick} onMarkComplete={onMarkComplete} />
    </div>
  );
}

/**
 * Sortable assignment row wrapper for @dnd-kit.
 * Uses useSortable hook and passes dnd-kit props to AssignmentRow.
 */
export function SortableAssignmentRow({
  assignment,
  onClick,
  onMarkComplete,
  id,
}: {
  assignment: Assignment;
  onClick?: (assignment: Assignment) => void;
  onMarkComplete?: (id: string) => Promise<void>;
  id: string;
}): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({ id, disabled: assignment.status === 'completed' });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
    >
      <AssignmentRow
        assignment={assignment}
        onClick={onClick}
        onMarkComplete={onMarkComplete}
        isDragging={isDragging}
      />
    </div>
  );
}

/**
 * Main assignment list component with full state handling:
 * - Skeleton loaders while fetching
 * - Empty state with CTA to Settings
 * - Error state with retry button
 * - Assignment rows when data available with drag-and-drop reordering
 */
export function AssignmentList({ onOpenSettings, onAssignmentClick }: AssignmentListProps): JSX.Element {
  // Initialize store on first mount
  useEffect(() => {
    const cleanup = initializeAssignmentsStore();
    return cleanup;
  }, []);

  // Select state from Zustand store
  const assignments = useAssignments();
  const isLoading = useAssignmentsLoading();
  const error = useAssignmentsError();
  const isEmpty = useAssignmentsEmpty();
  const priorityOrder = usePriorityOrder();
  const setPriorityOrder = useSetPriorityOrder();
  const reorderOptimistic = useReorderOptimistic();
  const revertPriorityOrder = useRevertPriorityOrder();

  // Get markComplete from hook
  const { markComplete } = useAssignmentsHook();

  // Toast for error notifications
  const { error: toastError } = useToast();

  // Priority keyboard shortcuts (Alt+Up/Down, Alt+Shift+Up/Down)
  usePriorityKeyboard({
    enabled: !isLoading && !error,
    onAnnounce: (message) => {
      // The announcement is handled by the PriorityLiveRegion component
      // which reads from a global ref. We could also use a context here.
    },
  });

  // Memoize refetch and clearError from store actions
  const refetch = useMemo(
    () => useAssignmentsStore.getState().fetchAssignments,
    []
  );
  const clearError = useMemo(
    () => useAssignmentsStore.getState().clearError,
    []
  );

  // Debounced reorder function for IPC call
  const debouncedReorderRef = useRef(
    debounce(async (ids: string[]) => {
      try {
        const result = await window.api.db.priority.reorder(ids);
        if (!result.ok) {
          throw new Error(result.error);
        }
        // Success - update the canonical priority order
        setPriorityOrder(ids);
      } catch {
        // Rollback on error
        revertPriorityOrder();
        toastError('Failed to save order. Reverting...');
      }
    }, REORDER_DEBOUNCE_MS)
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedReorderRef.current.cancel();
    };
  }, []);

  // Handle drag end event
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Only proceed if dropped over a different item
      if (!over || active.id === over.id) {
        return;
      }

      // Get current priority order
      const currentOrder = priorityOrder;

      // If priority order is empty, initialize from assignments
      let orderedIds = currentOrder.length > 0 ? [...currentOrder] : assignments.map((a) => a.id);

      // Convert UniqueIdentifier to string
      const activeId: string = String(active.id);
      const overId: string = String(over.id);

      // Find indices
      const oldIndex = orderedIds.indexOf(activeId);
      const newIndex = orderedIds.indexOf(overId);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      // Move item in array
      const [removed] = orderedIds.splice(oldIndex, 1);
      orderedIds.splice(newIndex, 0, removed);

      // 1. Optimistic update - immediate UI update
      reorderOptimistic(orderedIds);

      // 2. Debounced IPC call to persist
      debouncedReorderRef.current(orderedIds);
    },
    [priorityOrder, assignments, reorderOptimistic, setPriorityOrder, revertPriorityOrder, toastError]
  );

  // Set up sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event) => {
        // Use the sortable keyboard coordinates
        return {
          x: 0,
          y: 0,
        };
      },
    })
  );

  // Ref to hold latest sortedAssignments for renderDragOverlay callback
  const sortedAssignmentsRef = useRef<Assignment[]>([]);

  // Render prop for DragOverlay - defined early for stable hook order
  const renderDragOverlay = useCallback(
    ({
      isDragging,
      transform,
      activatorEvent,
      transition,
    }: {
      isDragging: boolean;
      transform: { x: number; y: number; scaleX: number; scaleY: number } | null;
      activatorEvent: { active: { id: string } | null } | null;
      transition: string | undefined;
    }): React.ReactElement | null => {
      if (!isDragging) return null;

      // Find the assignment being dragged
      const activeId = activatorEvent?.active?.id as string | undefined;
      if (!activeId) return null;

      const currentActiveId: string = activeId;
      const draggedAssignment = sortedAssignmentsRef.current.find((a) => a.id === currentActiveId);
      if (!draggedAssignment) return null;

      return (
        <CustomDragOverlay
          assignment={draggedAssignment}
          onClick={onAssignmentClick}
          onMarkComplete={markComplete}
          transform={transform}
          transition={transition}
        />
      );
    },
    [onAssignmentClick, markComplete]
  );

  // Sort assignments by priority order if available
  const sortedAssignments = useMemo(() => {
    if (priorityOrder.length === 0) {
      return assignments;
    }
    const orderMap = new Map(priorityOrder.map((id, index) => [id, index]));
    return [...assignments].sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Infinity;
      const bIndex = orderMap.get(b.id) ?? Infinity;
      return aIndex - bIndex;
    });
  }, [assignments, priorityOrder]);

  // Keep ref in sync with sortedAssignments
  useEffect(() => {
    sortedAssignmentsRef.current = sortedAssignments;
  }, [sortedAssignments]);

  // Render skeleton while loading
  if (isLoading) {
    return <AssignmentListSkeleton count={4} />;
  }

  // Show error state when fetch failed
  if (error) {
    return (
      <div className="assignment-list__error" role="alert" aria-live="assertive">
        <div className="error-banner">
          <div className="error-banner__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="error-banner__content">
            <p className="error-banner__message">{error}</p>
            <div className="error-banner__actions">
              <button
                className="error-banner__retry"
                onClick={() => {
                  clearError();
                  void refetch();
                }}
                type="button"
              >
                Retry
              </button>
              <button
                className="error-banner__dismiss"
                onClick={() => {
                  clearError();
                }}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
        {assignments.length > 0 && (
          <div className="assignment-list__rows" role="list" aria-label="Assignments">
            {assignments.length > VIRTUALIZATION_THRESHOLD ? (
              <VirtualizedAssignmentList
                assignments={sortedAssignments}
                onAssignmentClick={onAssignmentClick}
                onMarkComplete={markComplete}
              />
            ) : (
              sortedAssignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  onClick={onAssignmentClick}
                  onMarkComplete={markComplete}
                />
              ))
            )}
          </div>
        )}
        <PriorityLiveRegion />
      </div>
    );
  }

  // For virtualized lists (> 100 items), disable drag-and-drop
  if (sortedAssignments.length > VIRTUALIZATION_THRESHOLD) {
    return (
      <div className="assignment-list" role="list" aria-label="Assignments">
        <VirtualizedAssignmentList
          assignments={sortedAssignments}
          onAssignmentClick={onAssignmentClick}
          onMarkComplete={markComplete}
        />
        <PriorityLiveRegion />
      </div>
    );
  }

  // Show assignments list with drag-and-drop
  return (
    <>
      <AssignmentListDragDrop
        sortedAssignments={sortedAssignments}
        onAssignmentClick={onAssignmentClick}
        onMarkComplete={markComplete}
        onDragEnd={handleDragEnd}
        sensors={sensors}
        onOpenSettings={onOpenSettings}
        renderDragOverlay={renderDragOverlay}
      />
      <PriorityLiveRegion />
    </>
  );
}

/**
 * Virtualized assignment list using react-window.
 * Only renders visible rows for performance with large lists.
 * Drag-and-drop is disabled for virtualized lists.
 */
function VirtualizedAssignmentList({
  assignments,
  onAssignmentClick,
  onMarkComplete,
}: {
  assignments: Assignment[];
  onAssignmentClick?: (assignment: Assignment) => void;
  onMarkComplete?: (id: string) => Promise<void>;
}): JSX.Element {
  const itemData = useMemo(
    () => ({ assignments, onClick: onAssignmentClick, onMarkComplete }),
    [assignments, onAssignmentClick, onMarkComplete]
  );

  return (
    <List<{ assignments: Assignment[]; onClick?: (assignment: Assignment) => void; onMarkComplete?: (id: string) => Promise<void> }>
      className="assignment-list__virtualized"
      style={{ height: 600, width: '100%' }}
      rowCount={assignments.length}
      rowHeight={ROW_HEIGHT}
      rowProps={itemData}
      role="list"
      aria-label="Assignments"
      rowComponent={AssignmentRowRenderer}
    />
  );
}