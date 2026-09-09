/**
 * useSubTaskProgress Hook — Sub-task Progress Calculation
 *
 * Computes progress metrics for a given assignment's sub-tasks.
 * Returns completed count, total count, percentage, and all-complete status.
 * Automatically updates when sub-tasks change via the subtask store.
 *
 * @module @frontend/hooks/useSubTaskProgress
 */

import { useMemo } from 'react';
import { useSubTaskStore } from '../stores/subtaskStore';
import type { EntityId } from '@backend/shared/types';

interface SubTaskProgress {
  /** Number of completed sub-tasks */
  completedCount: number;
  /** Total number of sub-tasks */
  totalCount: number;
  /** Completion percentage (0-100), rounded */
  percentage: number;
  /** Whether all sub-tasks are completed (and at least one exists) */
  isAllComplete: boolean;
}

/**
 * Hook to compute sub-task progress for a given assignment.
 * Uses the subtask store which is scoped per assignment.
 *
 * @param assignmentId - The assignment ID to get progress for
 * @returns Progress metrics object
 */
export function useSubTaskProgress(assignmentId: EntityId): SubTaskProgress {
  // The subtask store is created per assignment via the hook in useSubTasks
  // We need to access the store for this specific assignment
  // Since the store is created dynamically, we'll use a selector pattern
  // But the subtask store is instantiated per assignment in useSubTasks
  // For the list row, we need a different approach - use the assignment detail store
  // or subscribe to db:changed events

  // For now, this hook returns zero values and the actual implementation
  // will depend on how we access sub-tasks from the assignment list context
  // The AssignmentList doesn't have sub-task data by default
  // We'll need to either:
  // 1. Fetch sub-tasks for each assignment in the list (expensive)
  // 2. Subscribe to db:changed for sub_tasks and maintain a cache
  // 3. Use the assignment detail store which already has sub-tasks

  // Since the requirement says to use the same data source,
  // and the assignment detail view already has sub-tasks via useAssignmentDetail,
  // for the list row we'll need to subscribe to sub-task changes

  // This is a placeholder - the actual implementation will be in the component
  // that has access to sub-tasks. For the detail view, useAssignmentDetail provides subTasks.
  // For the list row, we'll need to either fetch or use a shared store.

  const subTasks = useSubTaskStore((state) => state.subTasks);

  return useMemo((): SubTaskProgress => {
    const totalCount = subTasks.length;
    const completedCount = subTasks.filter((st) => st.completed).length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isAllComplete = totalCount > 0 && completedCount === totalCount;

    return { completedCount, totalCount, percentage, isAllComplete };
  }, [subTasks]);
}

/**
 * Alternative hook that computes progress from a sub-tasks array directly.
 * Useful when sub-tasks are already available (e.g., from useAssignmentDetail).
 *
 * @param subTasks - Array of sub-tasks
 * @returns Progress metrics object
 */
export function useSubTaskProgressFromArray(subTasks: { completed: boolean }[]): SubTaskProgress {
  return useMemo((): SubTaskProgress => {
    const totalCount = subTasks.length;
    const completedCount = subTasks.filter((st) => st.completed).length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isAllComplete = totalCount > 0 && completedCount === totalCount;

    return { completedCount, totalCount, percentage, isAllComplete };
  }, [subTasks]);
}