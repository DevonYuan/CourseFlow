/**
 * AssignmentListDragDrop — Drag-and-Drop Enabled Assignment List
 *
 * Renders assignments with drag-and-drop reordering using @dnd-kit.
 * No internal hooks to maintain stable hook order in parent AssignmentList.
 *
 * @module @frontend/components/AssignmentList/AssignmentListDragDrop
 */

import type { Assignment } from '@backend/shared/types';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import React from 'react';

import { SortableAssignmentRow } from '../AssignmentList';
import { EmptyState } from '../EmptyState';
import '../AssignmentList.css';

interface SubTaskProgress {
  completedCount: number;
  totalCount: number;
  percentage: number;
}

interface AssignmentListDragDropProps {
  /** Sorted assignments to render */
  sortedAssignments: Assignment[];
  /** Callback when assignment is clicked */
  onAssignmentClick?: (assignment: Assignment) => void;
  /** Callback when mark complete is triggered */
  onMarkComplete?: (id: string) => Promise<void>;
  /** Callback when delete is triggered */
  onDelete?: (id: string) => Promise<void>;
  /** Callback when drag ends with new order */
  onDragEnd: (event: import('@dnd-kit/core').DragEndEvent) => void;
  /** Sensors for drag-and-drop */
  sensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
  /** Callback to open settings from empty state */
  onOpenSettings: () => void;
  /** Render prop for DragOverlay */
  renderDragOverlay: ({
    isDragging,
    transform,
    activatorEvent,
    transition,
  }: {
    isDragging: boolean;
    transform: { x: number; y: number; scaleX: number; scaleY: number } | null;
    activatorEvent: { active: { id: string } | null } | null;
    transition: string | undefined;
  }) => React.ReactElement | null;
  /** Map of assignmentId -> sub-task progress for compact indicators */
  subTaskProgressMap?: Map<string, SubTaskProgress>;
}

/**
 * Renders assignments with drag-and-drop reordering.
 * This component is only rendered when drag-and-drop is enabled (< 100 items).
 * No hooks used internally to maintain stable hook order in parent.
 */
export function AssignmentListDragDrop({
  sortedAssignments,
  onAssignmentClick,
  onMarkComplete,
  onDelete,
  onDragEnd,
  sensors,
  onOpenSettings,
  renderDragOverlay,
  subTaskProgressMap,
}: AssignmentListDragDropProps): JSX.Element {
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <div className="assignment-list" role="list" aria-label="Assignments">
        {sortedAssignments.length === 0 ? (
          <EmptyState onOpenSettings={onOpenSettings} />
        ) : (
          <SortableContext
            items={sortedAssignments.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedAssignments.map((assignment) => {
              const progress = subTaskProgressMap?.get(assignment.id);
              return (
                <SortableAssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  onClick={onAssignmentClick}
                  onMarkComplete={onMarkComplete}
                  onDelete={onDelete}
                  id={assignment.id}
                  subTaskProgress={progress}
                />
              );
            })}
          </SortableContext>
        )}
        <DragOverlay>{renderDragOverlay as unknown as React.ReactNode}</DragOverlay>
      </div>
    </DndContext>
  );
}
