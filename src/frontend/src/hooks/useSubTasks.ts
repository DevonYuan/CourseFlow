/**
 * useSubTasks Hook — Sub-task Data Loading & Mutations
 *
 * Custom hook wrapping the subtask store + IPC calls for sub-tasks.
 * Handles fetching, adding, deleting, toggling with optimistic updates
 * and toast error handling.
 *
 * @module @frontend/hooks/useSubTasks
 */

import type { IpcResult } from '@backend/shared/ipc';
import type { SubTask, EntityId } from '@backend/shared/types';
import { useCallback, useEffect } from 'react';

import { useSubTaskStore } from '../stores/subtaskStore';

interface UseSubTasksReturn {
  /** Current sub-tasks list */
  subTasks: SubTask[];
  /** Whether a fetch is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Fetches sub-tasks for the given assignment */
  fetchSubTasks: (assignmentId: EntityId) => Promise<void>;
  /** Adds a new sub-task (optimistic + IPC) */
  addSubTask: (assignmentId: EntityId, title: string) => Promise<IpcResult<SubTask>>;
  /** Deletes a sub-task (optimistic + IPC with rollback on error) */
  deleteSubTask: (subTaskId: EntityId) => Promise<IpcResult<void>>;
  /** Toggles sub-task completion (optimistic + IPC with rollback on error) */
  toggleSubTask: (subTaskId: EntityId, completed: boolean) => Promise<IpcResult<SubTask>>;
  /** Optimistic add (immediate UI update) */
  optimisticAdd: (subTask: SubTask) => void;
  /** Rollback optimistic add */
  rollbackAdd: (tempId: EntityId) => void;
  /** Optimistic remove (immediate UI update) */
  optimisticRemove: (subTaskId: EntityId) => void;
  /** Confirm remove after successful IPC */
  confirmRemove: (subTaskId: EntityId) => void;
  /** Rollback optimistic remove */
  rollbackRemove: (subTaskId: EntityId, subTask: SubTask) => void;
  /** Get a temp ID for optimistic add */
  getTempId: () => EntityId;
}

/**
 * Custom hook for sub-task operations.
 * Wraps the Zustand store and IPC calls.
 *
 * @param assignmentId - The assignment ID to load sub-tasks for
 */
export function useSubTasks(assignmentId: EntityId): UseSubTasksReturn {
  const {
    subTasks,
    isLoading,
    error,
    setSubTasks,
    setLoading,
    setError,
    optimisticAdd,
    rollbackAdd,
    optimisticRemove,
    confirmRemove,
    rollbackRemove,
    getTempId,
  } = useSubTaskStore();

  // Fetch sub-tasks
  const fetchSubTasks = useCallback(
    async (id: EntityId) => {
      setLoading(true);
      setError(null);
      try {
        const result = await window.api.db.subtasks.list(id);
        if (result.ok) {
          setSubTasks(result.data);
        } else {
          setError(result.error || 'Failed to load sub-tasks');
          setLoading(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sub-tasks');
        setLoading(false);
      }
    },
    [setSubTasks, setLoading, setError]
  );

  // Add sub-task
  const addSubTask = useCallback(
    async (id: EntityId, title: string) => {
      const result = await window.api.db.subtasks.upsert({
        assignmentId: id,
        title,
        completed: false,
        order: 0, // Backend will determine position
      });
      return result;
    },
    []
  );

  // Delete sub-task (optimistic + IPC with rollback on error)
  const deleteSubTask = useCallback(
    async (id: EntityId): Promise<IpcResult<void>> => {
      // Find the sub-task to potentially rollback
      const subTaskToRemove = subTasks.find((st) => st.id === id);
      
      // Optimistic remove
      optimisticRemove(id);
      
      try {
        const result = await window.api.db.subtasks.delete(id);
        if (result.ok) {
          confirmRemove(id);
        } else if (subTaskToRemove) {
          // Rollback on error
          rollbackRemove(id, subTaskToRemove);
        }
        return result;
      } catch (err) {
        if (subTaskToRemove) {
          rollbackRemove(id, subTaskToRemove);
        }
        return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete sub-task' };
      }
    },
    [subTasks, optimisticRemove, confirmRemove, rollbackRemove]
  );

  // Toggle sub-task completion (optimistic + IPC with rollback on error)
  const toggleSubTask = useCallback(
    async (id: EntityId, completed: boolean): Promise<IpcResult<SubTask>> => {
      const { toggleSubTask: storeToggleSubTask } = useSubTaskStore.getState();
      return storeToggleSubTask(id, completed, () =>
        window.api.db.subtasks.toggle({ id, completed })
      );
    },
    []
  );

  // Subscribe to db:changed events for live updates
  useEffect(() => {
    if (!assignmentId) return;

    const unsubscribe = window.api.onDbChanged((event) => {
      const { table } = event;
      if (table !== 'sub_tasks') return;

      // We rely on the assignmentDetailStore's debounced refetch for live updates
      // But we can also handle optimistic confirmations here if needed
    });

    return () => unsubscribe();
  }, [assignmentId]);

  return {
    subTasks,
    isLoading,
    error,
    fetchSubTasks,
    addSubTask,
    deleteSubTask,
    toggleSubTask,
    optimisticAdd,
    rollbackAdd,
    optimisticRemove,
    confirmRemove,
    rollbackRemove,
    getTempId,
  };
}