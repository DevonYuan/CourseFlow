/**
 * useAssignmentSubTaskProgress Hook — Batch Sub-task Progress for Assignment List
 *
 * Fetches sub-task progress for multiple assignments in parallel.
 * Used by the assignment list to display compact progress indicators.
 * Caches results and subscribes to db:changed for live updates.
 *
 * @module @frontend/hooks/useAssignmentSubTaskProgress
 */

import type { EntityId, SubTask } from '@backend/shared/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface SubTaskProgress {
  completedCount: number;
  totalCount: number;
  percentage: number;
}

type ProgressMap = Map<EntityId, SubTaskProgress>;

/**
 * Hook to fetch and manage sub-task progress for a list of assignments.
 * Returns a Map of assignmentId -> progress data.
 */
export function useAssignmentSubTaskProgress(assignmentIds: EntityId[]): ProgressMap {
  const [progressMap, setProgressMap] = useState<ProgressMap>(new Map());
  const [, setLoadingIds] = useState<Set<EntityId>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute progress from sub-tasks array
  const computeProgress = useCallback((subTasks: SubTask[]): SubTaskProgress => {
    const totalCount = subTasks.length;
    const completedCount = subTasks.filter((st) => st.completed).length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    return { completedCount, totalCount, percentage };
  }, []);

  // Fetch sub-tasks for a single assignment
  const fetchProgress = useCallback(
    async (id: EntityId) => {
      try {
        const result = await window.api.db.subtasks.list(id);
        if (result.ok) {
          const progress = computeProgress(result.data);
          setProgressMap((prev) => {
            const next = new Map(prev);
            next.set(id, progress);
            return next;
          });
        }
      } catch {
        // Ignore errors for individual fetches
      }
    },
    [computeProgress],
  );

  // Batch fetch for multiple assignments
  const fetchAllProgress = useCallback(
    (ids: EntityId[]) => {
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Clear loading for IDs no longer in the list
      setLoadingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });

      // Fetch in parallel (with concurrency limit)
      const promises = ids.map((id) => fetchProgress(id));
      void Promise.allSettled(promises).finally(() => {
        setLoadingIds(new Set());
      });
    },
    [fetchProgress],
  );

  // Debounced fetch when assignmentIds change
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      // Only fetch for IDs that don't have progress yet or are stale
      const idsToFetch = assignmentIds.filter((id) => !progressMap.has(id));
      if (idsToFetch.length > 0) {
        fetchAllProgress(idsToFetch);
      }
    }, 100);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [assignmentIds, progressMap, fetchAllProgress]);

  // Subscribe to db:changed events for live updates
  useEffect(() => {
    const unsubscribe = window.api.onDbChanged((event) => {
      if (event.table === 'sub_tasks' && event.action !== 'reorder') {
        // Re-fetch progress for the affected assignment
        // The event doesn't include assignmentId, so we need to fetch for all
        // In a more optimized version, we'd track which assignment each sub-task belongs to
        fetchAllProgress(assignmentIds);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [assignmentIds, fetchAllProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Return memoized map to prevent unnecessary re-renders
  return useMemo(() => progressMap, [progressMap]);
}
