/**
 * GroupedAssignmentList — Grouped Assignment List Component
 *
 * Renders grouped assignments with collapsible section headers.
 * Each group has its own SortableContext for drag-and-drop within the group.
 * Respects current sort order within each group.
 *
 * @module @frontend/components/AssignmentList/GroupedAssignmentList
 */

import type { Assignment, GroupingType, SortOption } from '@backend/shared/types';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import {
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState, useCallback, useMemo } from 'react';

import type { GroupedAssignments } from '../../store/grouping';
import { SortableAssignmentRow } from '../AssignmentList';
import { AssignmentRow } from '../AssignmentRow';

import { DragOverlay as CustomDragOverlay } from './DragOverlay';
import { GroupHeader } from './GroupHeader';

import './GroupedAssignmentList.css';

interface GroupedAssignmentListProps {
  /** Grouped assignments to render */
  groupedAssignments: GroupedAssignments[];
  /** Optional callback when an assignment is clicked */
  onAssignmentClick?: (assignment: Assignment) => void;
  /** Optional callback to mark assignment as complete */
  onMarkComplete?: (id: string) => Promise<void>;
  /** Current grouping type for determining drag behavior */
  groupingType: GroupingType;
  /** Current sort option for within-group ordering */
  sortOption: SortOption;
  /** Priority order for 'priority' sort */
  priorityOrder: string[];
  /** Callback for drag end event */
  onDragEnd?: (event: DragEndEvent) => void;
}

/**
 * Sort assignments within a group based on sortOption.
 * Pure function - no hooks, safe to use in render.
 */
function sortAssignmentsWithinGroup(
  assignments: Assignment[],
  sortOption: SortOption,
  priorityOrder: string[]
): Assignment[] {
  if (assignments.length <= 1) return [...assignments];

  const sorted = [...assignments];

  switch (sortOption) {
    case 'priority': {
      const orderMap = new Map(priorityOrder.map((id, idx) => [id, idx]));
      return sorted.sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? Infinity;
        const bIndex = orderMap.get(b.id) ?? Infinity;
        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
        if (!a.dueAt && !b.dueAt) {
          return 0;
        }
        if (!a.dueAt) {
          return 1;
        }
        if (!b.dueAt) {
          return -1;
        }
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
    }
    case 'dueDateAsc': {
      return sorted.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) {
          return 0;
        }
        if (!a.dueAt) {
          return 1;
        }
        if (!b.dueAt) {
          return -1;
        }
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
    }
    case 'dueDateDesc': {
      return sorted.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) {
          return 0;
        }
        if (!a.dueAt) {
          return -1;
        }
        if (!b.dueAt) {
          return 1;
        }
        return new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime();
      });
    }
    case 'course': {
      return sorted.sort((a, b) => {
        const courseCompare = a.courseName.localeCompare(b.courseName);
        if (courseCompare !== 0) {
          return courseCompare;
        }
        if (!a.dueAt && !b.dueAt) {
          return 0;
        }
        if (!a.dueAt) {
          return 1;
        }
        if (!b.dueAt) {
          return -1;
        }
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
    }
    case 'createdDesc': {
      return sorted.sort((a, b) => {
        if (!a.createdAt && !b.createdAt) {
          return 0;
        }
        if (!a.createdAt) {
          return 1;
        }
        if (!b.createdAt) {
          return -1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    default: {
      return sorted;
    }
  }
}

interface GroupItemProps {
  group: GroupedAssignments;
  index: number;
  isExpanded: boolean;
  onToggle: (groupKey: string) => void;
  onAssignmentClick?: (assignment: Assignment) => void;
  onMarkComplete?: (id: string) => Promise<void>;
  sortOption: SortOption;
  priorityOrder: string[];
  isDragEnabled: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd?: (event: DragEndEvent) => void;
  renderDragOverlay: (props: {
    isDragging: boolean;
    transform: { x: number; y: number; scaleX: number; scaleY: number } | null;
    activatorEvent: { active: { id: string } | null } | null;
    transition: string | undefined;
  }) => React.ReactNode;
}

/**
 * Individual group item renderer with its own SortableContext.
 * Drag-and-drop only works within the same group when grouped.
 */
function GroupItem({
  group,
  index,
  isExpanded,
  onToggle,
  onAssignmentClick,
  onMarkComplete,
  sortOption,
  priorityOrder,
  isDragEnabled,
  sensors,
  onDragEnd,
  renderDragOverlay,
}: GroupItemProps): JSX.Element {
  const groupId = `${group.groupKey}-${index}`;
  const controlsId = `group-${groupId}`;

  // Sort assignments within this group - useMemo at component level
  const sortedAssignments = useMemo(
    () => sortAssignmentsWithinGroup(group.assignments, sortOption, priorityOrder),
    [group.assignments, sortOption, priorityOrder]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (onDragEnd) {
        onDragEnd(event);
      }
    },
    [onDragEnd]
  );

  if (!isExpanded) {
    return (
      <div key={group.groupKey} className="grouped-assignment-list__group" data-group-key={group.groupKey}>
        <GroupHeader
          group={group}
          isExpanded={false}
          onToggle={onToggle}
          groupId={groupId}
        />
      </div>
    );
  }

  return (
    <div key={group.groupKey} className="grouped-assignment-list__group" data-group-key={group.groupKey}>
      <GroupHeader
        group={group}
        isExpanded={true}
        onToggle={onToggle}
        groupId={groupId}
      />
      <div
        id={controlsId}
        role="list"
        aria-label={group.groupLabel}
        className="grouped-assignment-list__group-items"
      >
        {isDragEnabled ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedAssignments.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedAssignments.map((assignment) => (
                <SortableAssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  onClick={onAssignmentClick}
                  onMarkComplete={onMarkComplete}
                  id={assignment.id}
                />
              ))}
            </SortableContext>
            <DragOverlay>{renderDragOverlay}</DragOverlay>
          </DndContext>
        ) : (
          sortedAssignments.map((assignment) => (
            <AssignmentRow
              key={assignment.id}
              assignment={assignment}
              onClick={onAssignmentClick}
              onMarkComplete={onMarkComplete}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Main grouped assignment list component.
 * Manages per-group expanded state and renders groups with proper accessibility.
 */
export function GroupedAssignmentList({
  groupedAssignments,
  onAssignmentClick,
  onMarkComplete,
  groupingType,
  sortOption,
  priorityOrder,
  onDragEnd,
}: GroupedAssignmentListProps): JSX.Element {
  // Per-group expanded state (session only, not persisted)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(groupedAssignments.map((g) => g.groupKey))
  );

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Set up sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: () => ({ x: 0, y: 0 }),
    })
  );

  // All assignments flattened for drag overlay lookup
  const allAssignments = useMemo(
    () => groupedAssignments.flatMap((g) => g.assignments),
    [groupedAssignments]
  );

  // Render drag overlay callback for @dnd-kit DragOverlay
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
    }): React.ReactNode => {
      if (!isDragging) return null;

      const activeId = activatorEvent?.active?.id;
      if (!activeId) return null;

      const draggedAssignment = allAssignments.find((a) => a.id === activeId);
      if (!draggedAssignment) return null;

      return (
        <CustomDragOverlay
          assignment={draggedAssignment}
          onClick={onAssignmentClick}
          onMarkComplete={onMarkComplete}
          transform={transform}
          transition={transition}
        />
      );
    },
    [allAssignments, onAssignmentClick, onMarkComplete]
  );

  // Drag-and-drop is only enabled for 'priority' sort when grouping is 'none' or 'week'
  const isDragEnabled = sortOption === 'priority' && (groupingType === 'none' || groupingType === 'week');

  return (
    <div className="grouped-assignment-list" role="list" aria-label="Assignments grouped">
      {groupedAssignments.map((group, index) => (
        <GroupItem
          key={group.groupKey}
          group={group}
          index={index}
          isExpanded={expandedGroups.has(group.groupKey)}
          onToggle={toggleGroup}
          onAssignmentClick={onAssignmentClick}
          onMarkComplete={onMarkComplete}
          sortOption={sortOption}
          priorityOrder={priorityOrder}
          isDragEnabled={isDragEnabled}
          sensors={sensors}
          onDragEnd={onDragEnd}
          renderDragOverlay={renderDragOverlay}
        />
      ))}
    </div>
  );
}