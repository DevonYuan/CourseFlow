/**
 * Assignment Detail Store — Zustand
 *
 * Manages state for a single assignment detail view including the assignment,
 * its sub-tasks, and notes. Handles data fetching, live updates via db:changed events,
 * and provides loading/error/not-found states.
 *
 * @module @frontend/store/assignmentDetailStore
 */

import type { IpcEvents } from '@backend/shared/ipc';
import type { Assignment, SubTask, Note, EntityId } from '@backend/shared/types';
import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

import { debounce } from '../utils/debounce';

/**
 * State shape for a single assignment detail.
 */
interface AssignmentDetailState {
  /** The assignment being viewed */
  assignment: Assignment | null;
  /** Sub-tasks belonging to the assignment */
  subTasks: SubTask[];
  /** Notes belonging to the assignment */
  notes: Note[];
  /** Whether any fetch operation is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether the assignment was not found (404) */
  notFound: boolean;
  /** The current assignment ID being viewed */
  currentAssignmentId: EntityId | null;
  /** Internal: AbortController for in-flight requests */
  _abortController: AbortController | null;
  /** Internal: Event unsubscribe function */
  _eventUnsubscribe: (() => void) | null;
  /** Internal: Debounced refetch cleanup for db:changed events */
  _debouncedRefetch: { cancel: () => void } | null;
  /** Internal: Map of sub-task ID -> assignment ID for event filtering */
  _subTaskAssignmentMap: Map<string, EntityId>;
  /** Internal: Map of note ID -> assignment ID for event filtering */
  _noteAssignmentMap: Map<string, EntityId>;
}

interface AssignmentDetailActions {
  /**
   * Fetches assignment, sub-tasks, and notes for the given assignment ID.
   * Cancels any in-flight requests and clears previous state.
   */
  fetch: (assignmentId: EntityId) => Promise<void>;
  /** Refetches all data for the current assignment ID */
  refetch: () => Promise<void>;
  /** Refetches only the assignment for the current ID (no loading spinner) */
  refetchAssignment: () => Promise<void>;
  /** Refetches only the sub-tasks list for the current assignment (no loading spinner) */
  refetchSubTasks: () => Promise<void>;
  /** Refetches only the notes list for the current assignment (no loading spinner) */
  refetchNotes: () => Promise<void>;
  /** Subscribes to db:changed events for live updates */
  subscribeToChanges: (assignmentId: EntityId) => void;
  /** Unsubscribes from db:changed events */
  unsubscribe: () => void;
  /** Clears error state */
  clearError: () => void;
  /** Updates assignment optimistically (for live updates) */
  setAssignment: (assignment: Assignment) => void;
  /** Updates sub-tasks list optimistically */
  setSubTasks: (subTasks: SubTask[]) => void;
  /** Updates notes list optimistically */
  setNotes: (notes: Note[]) => void;
  /** Adds a sub-task optimistically */
  addSubTask: (subTask: SubTask) => void;
  /** Updates a sub-task optimistically */
  updateSubTask: (subTask: SubTask) => void;
  /** Removes a sub-task optimistically */
  removeSubTask: (subTaskId: EntityId) => void;
  /** Adds a note optimistically */
  addNote: (note: Note) => void;
  /** Updates a note optimistically */
  updateNote: (note: Note) => void;
  /** Removes a note optimistically */
  removeNote: (noteId: EntityId) => void;
  /** Resets store to initial state */
  reset: () => void;
}

type AssignmentDetailStore = AssignmentDetailState & AssignmentDetailActions;

/**
 * Initial state for the store.
 */
const initialState: AssignmentDetailState = {
  assignment: null,
  subTasks: [],
  notes: [],
  isLoading: false,
  error: null,
  notFound: false,
  currentAssignmentId: null,
  _abortController: null,
  _eventUnsubscribe: null,
  _debouncedRefetch: null,
  _subTaskAssignmentMap: new Map(),
  _noteAssignmentMap: new Map(),
};

/**
 * Zustand store for assignment detail view.
 * Keyed by assignmentId internally to support potential future multi-tab caching.
 */
export const useAssignmentDetailStore = create<AssignmentDetailStore>()((set, get) => ({
  ...initialState,

  fetch: async (assignmentId: EntityId) => {
    // Cancel any in-flight request
    const { _abortController } = get();
    if (_abortController) {
      _abortController.abort();
    }

    // Create new AbortController for this fetch
    const abortController = new AbortController();
    set({ _abortController: abortController, currentAssignmentId: assignmentId });

    // Reset state for new assignment (but keep loading true)
    set({
      assignment: null,
      subTasks: [],
      notes: [],
      isLoading: true,
      error: null,
      notFound: false,
      _subTaskAssignmentMap: new Map(),
      _noteAssignmentMap: new Map(),
    });

    try {
      // Fire all three requests in parallel
      const [assignmentResult, subTasksResult, notesResult] = await Promise.allSettled([
        window.api.db.assignments.get(assignmentId),
        window.api.db.subtasks.list(assignmentId),
        window.api.db.notes.list(assignmentId),
      ]);

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      // Handle assignment result
      let assignment: Assignment | null = null;
      if (assignmentResult.status === 'fulfilled') {
        if (assignmentResult.value.ok) {
          assignment = assignmentResult.value.data;
        } else {
          throw new Error(assignmentResult.value.error || 'Failed to load assignment');
        }
      } else {
        throw assignmentResult.reason;
      }

      // Handle sub-tasks result
      let subTasks: SubTask[] = [];
      if (subTasksResult.status === 'fulfilled') {
        if (subTasksResult.value.ok) {
          subTasks = subTasksResult.value.data;
        } else {
          console.warn('Failed to load sub-tasks:', subTasksResult.value.error);
        }
      } else {
        console.warn('Failed to load sub-tasks:', subTasksResult.reason);
      }

      // Handle notes result
      let notes: Note[] = [];
      if (notesResult.status === 'fulfilled') {
        if (notesResult.value.ok) {
          notes = notesResult.value.data;
        } else {
          console.warn('Failed to load notes:', notesResult.value.error);
        }
      } else {
        console.warn('Failed to load notes:', notesResult.reason);
      }

      // Build ID maps for event filtering
      const subTaskAssignmentMap = new Map<string, EntityId>();
      subTasks.forEach((st) => subTaskAssignmentMap.set(st.id, st.assignmentId));

      const noteAssignmentMap = new Map<string, EntityId>();
      notes.forEach((n) => noteAssignmentMap.set(n.id, n.assignmentId));

      if (!assignment) {
        set({
          isLoading: false,
          notFound: true,
          _abortController: null,
        });
        return;
      }

      set({
        assignment,
        subTasks,
        notes,
        isLoading: false,
        error: null,
        notFound: false,
        _abortController: null,
        _subTaskAssignmentMap: subTaskAssignmentMap,
        _noteAssignmentMap: noteAssignmentMap,
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to load assignment';
      set({
        isLoading: false,
        error: errorMessage,
        _abortController: null,
      });
    }
  },

  refetch: async () => {
    const { currentAssignmentId } = get();
    if (currentAssignmentId) {
      await get().fetch(currentAssignmentId);
    }
  },

  /**
   * Refetches only the assignment (preserves sub-tasks/notes state, no loading spinner).
   * Used on `db:changed` for the assignments table.
   */
  refetchAssignment: async () => {
    const { currentAssignmentId } = get();
    if (!currentAssignmentId) return;
    const result = await window.api.db.assignments.get(currentAssignmentId);
    if (result.ok) {
      if (result.data) {
        set({ assignment: result.data, notFound: false, error: null });
      } else {
        set({ assignment: null, notFound: true, error: null });
      }
    } else {
      set({ error: result.error || 'Failed to load assignment' });
    }
  },

  /**
   * Refetches only the sub-tasks list for the current assignment.
   * Preserves assignment/notes state, no loading spinner.
   */
  refetchSubTasks: async () => {
    const { currentAssignmentId } = get();
    if (!currentAssignmentId) return;
    const result = await window.api.db.subtasks.list(currentAssignmentId);
    if (result.ok) {
      const subTaskAssignmentMap = new Map<string, EntityId>();
      result.data.forEach((st) => subTaskAssignmentMap.set(st.id, st.assignmentId));
      set({ subTasks: result.data, _subTaskAssignmentMap: subTaskAssignmentMap, error: null });
    } else {
      console.warn('Failed to refetch sub-tasks:', result.error);
    }
  },

  /**
   * Refetches only the notes list for the current assignment.
   * Preserves assignment/sub-task state, no loading spinner.
   */
  refetchNotes: async () => {
    const { currentAssignmentId } = get();
    if (!currentAssignmentId) return;
    const result = await window.api.db.notes.list(currentAssignmentId);
    if (result.ok) {
      const noteAssignmentMap = new Map<string, EntityId>();
      result.data.forEach((n) => noteAssignmentMap.set(n.id, n.assignmentId));
      set({ notes: result.data, _noteAssignmentMap: noteAssignmentMap, error: null });
    } else {
      console.warn('Failed to refetch notes:', result.error);
    }
  },

  subscribeToChanges: (assignmentId: EntityId) => {
    // Unsubscribe from any existing subscription
    get().unsubscribe();

    // Per-table debounced refetches (300ms) to avoid hammering IPC on rapid events
    const debouncedAssignmentRefetch = debounce(() => {
      void get().refetchAssignment();
    }, 300);
    const debouncedSubTasksRefetch = debounce(() => {
      void get().refetchSubTasks();
    }, 300);
    const debouncedNotesRefetch = debounce(() => {
      void get().refetchNotes();
    }, 300);

    // Subscribe to db:changed events
    const unsubscribe = window.api.onDbChanged((event: IpcEvents['db:changed']) => {
      const { currentAssignmentId } = get();
      if (!currentAssignmentId || currentAssignmentId !== assignmentId) {
        return; // Not our assignment
      }

      const { table, action, id } = event;

      switch (table) {
        case 'assignments': {
          if (id === assignmentId) {
            if (action === 'delete') {
              set({ notFound: true, assignment: null });
            } else {
              // Refetch assignment to get updated data
              debouncedAssignmentRefetch();
            }
          }
          break;
        }

        case 'sub_tasks': {
          const subTaskAssignmentId = get()._subTaskAssignmentMap.get(id);
          // Refetch if the sub-task belongs to this assignment, or if it's a new
          // insert (unknown ID that may belong to this assignment)
          if (subTaskAssignmentId === assignmentId || action === 'insert') {
            debouncedSubTasksRefetch();
          }
          break;
        }

        case 'notes': {
          const noteAssignmentId = get()._noteAssignmentMap.get(id);
          // Refetch if the note belongs to this assignment, or if it's a new
          // insert (unknown ID that may belong to this assignment)
          if (noteAssignmentId === assignmentId || action === 'insert') {
            debouncedNotesRefetch();
          }
          break;
        }
      }
    });

    // Keep refs for cleanup
    set({
      _debouncedRefetch: {
        cancel: () => {
          debouncedAssignmentRefetch.cancel();
          debouncedSubTasksRefetch.cancel();
          debouncedNotesRefetch.cancel();
        },
      },
      _eventUnsubscribe: unsubscribe,
    });
  },

  unsubscribe: () => {
    const { _eventUnsubscribe, _debouncedRefetch } = get();
    if (_eventUnsubscribe) {
      _eventUnsubscribe();
    }
    if (_debouncedRefetch) {
      _debouncedRefetch.cancel();
    }
    set({ _eventUnsubscribe: null, _debouncedRefetch: null });
  },

  clearError: () => {
    set({ error: null });
  },

  setAssignment: (assignment: Assignment) => {
    set({ assignment });
  },

  setSubTasks: (subTasks: SubTask[]) => {
    const subTaskAssignmentMap = new Map<string, EntityId>();
    subTasks.forEach((st) => subTaskAssignmentMap.set(st.id, st.assignmentId));
    set({ subTasks, _subTaskAssignmentMap: subTaskAssignmentMap });
  },

  setNotes: (notes: Note[]) => {
    const noteAssignmentMap = new Map<string, EntityId>();
    notes.forEach((n) => noteAssignmentMap.set(n.id, n.assignmentId));
    // Sort by updatedAt descending (newest first)
    const sortedNotes = [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    set({ notes: sortedNotes, _noteAssignmentMap: noteAssignmentMap });
  },

  addSubTask: (subTask: SubTask) => {
    set((state) => {
      const newMap = new Map(state._subTaskAssignmentMap);
      newMap.set(subTask.id, subTask.assignmentId);
      return {
        subTasks: [...state.subTasks, subTask].sort((a, b) => a.order - b.order),
        _subTaskAssignmentMap: newMap,
      };
    });
  },

  updateSubTask: (subTask: SubTask) => {
    set((state) => ({
      subTasks: state.subTasks.map((st) => (st.id === subTask.id ? subTask : st)).sort((a, b) => a.order - b.order),
    }));
  },

  removeSubTask: (subTaskId: EntityId) => {
    set((state) => {
      const newMap = new Map(state._subTaskAssignmentMap);
      newMap.delete(subTaskId);
      return {
        subTasks: state.subTasks.filter((st) => st.id !== subTaskId),
        _subTaskAssignmentMap: newMap,
      };
    });
  },

  addNote: (note: Note) => {
    set((state) => {
      const newMap = new Map(state._noteAssignmentMap);
      newMap.set(note.id, note.assignmentId);
      return {
        notes: [note, ...state.notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
        _noteAssignmentMap: newMap,
      };
    });
  },

  updateNote: (note: Note) => {
    set((state) => ({
      notes: state.notes.map((n) => (n.id === note.id ? note : n)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    }));
  },

  removeNote: (noteId: EntityId) => {
    set((state) => {
      const newMap = new Map(state._noteAssignmentMap);
      newMap.delete(noteId);
      return {
        notes: state.notes.filter((n) => n.id !== noteId),
        _noteAssignmentMap: newMap,
      };
    });
  },

  reset: () => {
    get().unsubscribe();
    const { _abortController } = get();
    if (_abortController) {
      _abortController.abort();
    }
    set({ ...initialState });
  },
}));

/**
 * Memoized selector hooks for optimal re-render performance.
 * Components should use these instead of the full store.
 */
export const useAssignmentDetail = () =>
  useAssignmentDetailStore(
    useShallow((state) => ({
      assignment: state.assignment,
      subTasks: state.subTasks,
      notes: state.notes,
      isLoading: state.isLoading,
      error: state.error,
      notFound: state.notFound,
      refetch: state.refetch,
    })),
  );

export const useAssignmentDetailActions = () =>
  useAssignmentDetailStore(
    useShallow((state) => ({
      fetch: state.fetch,
      refetch: state.refetch,
      refetchAssignment: state.refetchAssignment,
      refetchSubTasks: state.refetchSubTasks,
      refetchNotes: state.refetchNotes,
      subscribeToChanges: state.subscribeToChanges,
      unsubscribe: state.unsubscribe,
      clearError: state.clearError,
      setAssignment: state.setAssignment,
      setSubTasks: state.setSubTasks,
      setNotes: state.setNotes,
      addSubTask: state.addSubTask,
      updateSubTask: state.updateSubTask,
      removeSubTask: state.removeSubTask,
      addNote: state.addNote,
      updateNote: state.updateNote,
      removeNote: state.removeNote,
      reset: state.reset,
    })),
  );

export const useAssignmentDetailAssignment = () =>
  useAssignmentDetailStore((state) => state.assignment);

export const useAssignmentDetailSubTasks = () =>
  useAssignmentDetailStore((state) => state.subTasks);

export const useAssignmentDetailNotes = () =>
  useAssignmentDetailStore((state) => state.notes);

export const useAssignmentDetailIsLoading = () =>
  useAssignmentDetailStore((state) => state.isLoading);

export const useAssignmentDetailError = () =>
  useAssignmentDetailStore((state) => state.error);

export const useAssignmentDetailNotFound = () =>
  useAssignmentDetailStore((state) => state.notFound);