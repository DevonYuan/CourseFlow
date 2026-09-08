/**
 * SubTask Store — Zustand
 *
 * Manages sub-task state per assignment with optimistic updates.
 * Scoped to a single assignment at a time (keyed by assignmentId).
 *
 * @module @frontend/stores/subtaskStore
 */

import type { SubTask, EntityId, IsoDateTime } from '@backend/shared/types';
import { create } from 'zustand';

interface SubTaskState {
  /** Sub-tasks for the current assignment */
  subTasks: SubTask[];
  /** Whether a fetch operation is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Map of temp ID -> real ID for optimistic adds */
  _tempIdMap: Map<string, EntityId>;
  /** Counter for generating unique temp IDs */
  _tempIdCounter: number;
}

interface SubTaskActions {
  /** Sets the sub-tasks list (from fetch) */
  setSubTasks: (subTasks: SubTask[]) => void;
  /** Adds a sub-task optimistically (temp ID) */
  optimisticAdd: (subTask: SubTask) => void;
  /** Replaces temp ID with real ID after successful IPC */
  confirmAdd: (tempId: EntityId, realSubTask: SubTask) => void;
  /** Rolls back an optimistic add */
  rollbackAdd: (tempId: EntityId) => void;
  /** Removes a sub-task optimistically */
  optimisticRemove: (subTaskId: EntityId) => void;
  /** Confirms removal after successful IPC */
  confirmRemove: (subTaskId: EntityId) => void;
  /** Rolls back an optimistic remove */
  rollbackRemove: (subTaskId: EntityId, subTask: SubTask) => void;
  /** Toggles completion state optimistically */
  optimisticToggle: (subTaskId: EntityId, completed: boolean) => void;
  /** Confirms toggle after successful IPC */
  confirmToggle: (subTaskId: EntityId, subTask: SubTask) => void;
  /** Rolls back toggle */
  rollbackToggle: (subTaskId: EntityId, previousCompleted: boolean) => void;
  /** Sets loading state */
  setLoading: (isLoading: boolean) => void;
  /** Sets error state */
  setError: (error: string | null) => void;
  /** Resets store to initial state */
  reset: () => void;
  /** Generates a unique temp ID for optimistic adds */
  getTempId: () => EntityId;
}

type SubTaskStore = SubTaskState & SubTaskActions;

const initialState: SubTaskState = {
  subTasks: [],
  isLoading: false,
  error: null,
  _tempIdMap: new Map(),
  _tempIdCounter: 0,
};

/**
 * Zustand store for sub-tasks.
 * Creates a separate store instance per assignmentId via the hook.
 */
export const createSubTaskStore = () =>
  create<SubTaskStore>()((set, get) => ({
    ...initialState,

    setSubTasks: (subTasks: SubTask[]) => {
      set({ subTasks, isLoading: false, error: null });
    },

    optimisticAdd: (subTask: SubTask) => {
      set((state) => ({
        subTasks: [...state.subTasks, subTask].sort((a, b) => a.order - b.order),
        _tempIdMap: new Map(state._tempIdMap).set(subTask.id, subTask.id),
      }));
    },

    confirmAdd: (tempId: EntityId, realSubTask: SubTask) => {
      set((state) => {
        const newMap = new Map(state._tempIdMap);
        newMap.delete(tempId);
        newMap.set(realSubTask.id, realSubTask.id);
        return {
          subTasks: state.subTasks
            .map((st) => (st.id === tempId ? realSubTask : st))
            .sort((a, b) => a.order - b.order),
          _tempIdMap: newMap,
        };
      });
    },

    rollbackAdd: (tempId: EntityId) => {
      set((state) => {
        const newMap = new Map(state._tempIdMap);
        newMap.delete(tempId);
        return {
          subTasks: state.subTasks.filter((st) => st.id !== tempId),
          _tempIdMap: newMap,
        };
      });
    },

    optimisticRemove: (subTaskId: EntityId) => {
      set((state) => ({
        subTasks: state.subTasks.filter((st) => st.id !== subTaskId),
      }));
    },

    confirmRemove: (subTaskId: EntityId) => {
      // Already removed optimistically, just ensure it's gone
      set((state) => ({
        subTasks: state.subTasks.filter((st) => st.id !== subTaskId),
      }));
    },

    rollbackRemove: (subTaskId: EntityId, subTask: SubTask) => {
      set((state) => ({
        subTasks: [...state.subTasks, subTask].sort((a, b) => a.order - b.order),
      }));
    },

    optimisticToggle: (subTaskId: EntityId, completed: boolean) => {
      set((state) => ({
        subTasks: state.subTasks.map((st) =>
          st.id === subTaskId
            ? { ...st, completed, updatedAt: new Date().toISOString() as IsoDateTime }
            : st
        ),
      }));
    },

    confirmToggle: (subTaskId: EntityId, subTask: SubTask) => {
      set((state) => ({
        subTasks: state.subTasks.map((st) => (st.id === subTaskId ? subTask : st)).sort((a, b) => a.order - b.order),
      }));
    },

    rollbackToggle: (subTaskId: EntityId, previousCompleted: boolean) => {
      set((state) => ({
        subTasks: state.subTasks.map((st) =>
          st.id === subTaskId ? { ...st, completed: previousCompleted } : st
        ),
      }));
    },

    setLoading: (isLoading: boolean) => {
      set({ isLoading });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    reset: () => {
      set(initialState);
    },

    getTempId: () => {
      const counter = get()._tempIdCounter + 1;
      set({ _tempIdCounter: counter });
      return `temp-${Date.now()}-${counter}` as EntityId;
    },
  }));

/**
 * Hook to get a store instance for a specific assignment.
 * Note: This creates a new store per assignmentId. For simplicity,
 * we use a single store and reset on assignment change.
 */
export const useSubTaskStore = createSubTaskStore();