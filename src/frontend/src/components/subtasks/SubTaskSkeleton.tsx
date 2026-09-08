/**
 * SubTaskSkeleton — Sub-task Loading Skeleton Component
 *
 * Placeholder shown while sub-tasks are loading.
 *
 * @module @frontend/components/subtasks/SubTaskSkeleton
 */

import React from 'react';

/**
 * SubTaskSkeleton - Skeleton loader for a single sub-task row.
 */
export function SubTaskSkeleton(): JSX.Element {
  return (
    <li className="subtask-row subtask-row--skeleton" aria-hidden="true">
      <div className="subtask-row__checkbox-skeleton" />
      <div className="subtask-row__title-skeleton" />
      <div className="subtask-row__drag-skeleton" />
      <div className="subtask-row__delete-skeleton" />
    </li>
  );
}