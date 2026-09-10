/**
 * SubTaskList — Sub-task List Container Component
 *
 * Renders the list of sub-tasks for an assignment, including the add input,
 * empty state, and loading skeletons. Manages optimistic updates via
 * the subtask store and handles live updates from db:changed events.
 *
 * @module @frontend/components/subtasks/SubTaskList
 */

import type { SubTask, EntityId, IsoDateTime } from '@backend/shared/types';
import React, { useEffect, useCallback, useMemo } from 'react';

import { useToast } from '../../context/ToastContext';
import { useSubTasks } from '../../hooks/useSubTasks';
import { ConfirmModal } from '../ui/ConfirmModal';

import { SubTaskAddInput } from './SubTaskAddInput';
import { SubTaskRow } from './SubTaskRow';
import { SubTaskSkeleton } from './SubTaskSkeleton';

import './SubTasks.css';

interface SubTaskListProps {
  /** The assignment ID to load sub-tasks for */
  assignmentId: EntityId;
}

/**
 * SubTaskList - Main container for sub-tasks in the assignment detail view.
 * Handles: loading, empty state, list rendering, add/delete, toggle, live updates.
 */
export function SubTaskList({ assignmentId }: SubTaskListProps): JSX.Element {
  const {
    subTasks,
    isLoading,
    fetchSubTasks,
    addSubTask,
    deleteSubTask,
    toggleSubTask,
    optimisticAdd,
    rollbackAdd,
    getTempId,
  } = useSubTasks(assignmentId);

  const { error: showErrorToast } = useToast();
  const [deleteTargetId, setDeleteTargetId] = React.useState<EntityId | null>(null);
  const [deleteTargetTitle, setDeleteTargetTitle] = React.useState<string>('');
  const [togglingId, setTogglingId] = React.useState<EntityId | null>(null);

  // Initial fetch
  useEffect(() => {
    void fetchSubTasks(assignmentId);
  }, [assignmentId, fetchSubTasks]);

  // Handle add sub-task
  const handleAdd = useCallback(
    async (title: string) => {
      const tempId = getTempId();
      const now = new Date().toISOString() as IsoDateTime;
      const tempSubTask: SubTask = {
        id: tempId,
        assignmentId,
        title: title.trim(),
        completed: false,
        order: subTasks.length, // Will be corrected by server
        createdAt: now,
        updatedAt: now,
      };

      // Optimistic add
      optimisticAdd(tempSubTask);

      try {
        const result = await addSubTask(assignmentId, title.trim());
        if (result.ok) {
          // Replace temp ID with real ID - handled by store via refetch or we could update directly
          // The store's addSubTask will be called via live update from db:changed
        } else {
          // Rollback on error
          rollbackAdd(tempId);
          showErrorToast('Failed to add sub-task', {
            duration: 5000,
          });
        }
      } catch {
        rollbackAdd(tempId);
        showErrorToast('Failed to add sub-task', { duration: 5000 });
      }
    },
    [assignmentId, subTasks.length, addSubTask, optimisticAdd, rollbackAdd, getTempId, showErrorToast]
  );

  // Handle delete sub-task - open confirmation modal
  const handleDeleteClick = useCallback((id: EntityId, title: string) => {
    setDeleteTargetId(id);
    setDeleteTargetTitle(title);
  }, []);

  // Handle confirmed delete
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTargetId) return;

    const idToDelete = deleteTargetId;

    try {
      const result = await deleteSubTask(idToDelete);
      if (!result.ok) {
        showErrorToast('Failed to delete sub-task', { duration: 5000 });
      }
    } catch {
      showErrorToast('Failed to delete sub-task', { duration: 5000 });
    } finally {
      setDeleteTargetId(null);
      setDeleteTargetTitle('');
    }
  }, [deleteTargetId, deleteSubTask, showErrorToast]);

  // Handle delete cancel
  const handleDeleteCancel = useCallback(() => {
    setDeleteTargetId(null);
    setDeleteTargetTitle('');
  }, []);

  // Handle toggle sub-task completion
  const handleToggle = useCallback(
    async (id: EntityId, completed: boolean) => {
      setTogglingId(id);
      try {
        const result = await toggleSubTask(id, completed);
        if (!result.ok) {
          showErrorToast('Failed to update sub-task', {
            duration: 5000,
            action: {
              label: 'Retry',
              onClick: () => void handleToggle(id, completed),
            },
          });
        }
      } catch {
        showErrorToast('Failed to update sub-task', {
          duration: 5000,
          action: {
            label: 'Retry',
            onClick: () => void handleToggle(id, completed),
          },
        });
      } finally {
        setTogglingId(null);
      }
    },
    [toggleSubTask, showErrorToast]
  );

  // Memoize sorted sub-tasks by order
  const sortedSubTasks = useMemo(
    () => [...subTasks].sort((a, b) => a.order - b.order),
    [subTasks]
  );

  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className="subtask-list" role="status" aria-label="Loading sub-tasks">
        <SubTaskSkeleton />
        <SubTaskSkeleton />
        <SubTaskSkeleton />
      </div>
    );
  }

  return (
    <div className="subtask-list">
      {sortedSubTasks.length === 0 ? (
        <div className="subtask-list__empty">
          <p className="subtask-list__empty-message">
            No sub-tasks yet — add one below
          </p>
        </div>
      ) : (
        <ul className="subtask-list__list" role="list" aria-label="Sub-tasks">
          {sortedSubTasks.map((subTask) => (
            <SubTaskRow
              key={subTask.id}
              subTask={subTask}
              onDelete={handleDeleteClick}
              onToggle={handleToggle}
              isDeleting={deleteTargetId === subTask.id}
              isToggling={togglingId === subTask.id}
            />
          ))}
        </ul>
      )}

      <SubTaskAddInput onAdd={(title) => void handleAdd(title)} disabled={isLoading} />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={deleteTargetId !== null}
        title="Delete sub-task?"
        message={
          deleteTargetTitle
            ? `Are you sure you want to delete \u201C${deleteTargetTitle}\u201D? This cannot be undone.`
            : 'Are you sure you want to delete this sub-task? This cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="destructive"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}