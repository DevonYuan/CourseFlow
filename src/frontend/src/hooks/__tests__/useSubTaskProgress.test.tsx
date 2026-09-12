/**
 * useSubTaskProgress Hook Tests
 *
 * Tests for the useSubTaskProgress hook covering:
 * - Progress calculation (completed count, total count, percentage)
 * - isAllComplete detection
 * - Reactivity to sub-task changes
 * - Edge cases (empty arrays, all completed, none completed)
 *
 * @module @frontend/src/hooks/__tests__/useSubTaskProgress
 */

// @vitest-environment jsdom

import type { SubTask, EntityId, IsoDateTime } from '@backend/shared/types';
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useSubTaskProgressFromArray } from '../useSubTaskProgress';

const assignmentId = 'assignment-1' as EntityId;
const now = '2026-09-05T12:00:00.000Z' as IsoDateTime;

vi.mock('../stores/subtaskStore', () => ({
  useSubTaskStore: () => ({
    subTasks: [
      {
        id: 'subtask-1' as EntityId,
        assignmentId,
        title: 'Sub-task 1',
        completed: false,
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'subtask-2' as EntityId,
        assignmentId,
        title: 'Sub-task 2',
        completed: true,
        order: 1,
        createdAt: now,
        updatedAt: now,
      },
    ],
  }),
}));

describe('useSubTaskProgress', () => {
  describe('useSubTaskProgress hook', () => {
    it('should calculate correct progress for partially completed sub-tasks', () => {
      const subTasks: SubTask[] = [
        {
          id: '1' as EntityId,
          assignmentId,
          title: 'Task 1',
          completed: false,
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '2' as EntityId,
          assignmentId,
          title: 'Task 2',
          completed: true,
          order: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '3' as EntityId,
          assignmentId,
          title: 'Task 3',
          completed: false,
          order: 2,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '4' as EntityId,
          assignmentId,
          title: 'Task 4',
          completed: true,
          order: 3,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const { result } = renderHook(() => useSubTaskProgressFromArray(subTasks));

      expect(result.current.completedCount).toBe(2);
      expect(result.current.totalCount).toBe(4);
      expect(result.current.percentage).toBe(50);
      expect(result.current.isAllComplete).toBe(false);
    });

    it('should return zero values for empty sub-tasks array', () => {
      const { result } = renderHook(() => useSubTaskProgressFromArray([]));

      expect(result.current.completedCount).toBe(0);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.percentage).toBe(0);
      expect(result.current.isAllComplete).toBe(false);
    });

    it('should show 100% when all sub-tasks are completed', () => {
      const subTasks: SubTask[] = [
        {
          id: '1' as EntityId,
          assignmentId,
          title: 'Task 1',
          completed: true,
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '2' as EntityId,
          assignmentId,
          title: 'Task 2',
          completed: true,
          order: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '3' as EntityId,
          assignmentId,
          title: 'Task 3',
          completed: true,
          order: 2,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const { result } = renderHook(() => useSubTaskProgressFromArray(subTasks));

      expect(result.current.completedCount).toBe(3);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.percentage).toBe(100);
      expect(result.current.isAllComplete).toBe(true);
    });

    it('should handle rounding correctly', () => {
      const subTasks: SubTask[] = [
        {
          id: '1' as EntityId,
          assignmentId,
          title: 'Task 1',
          completed: false,
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '2' as EntityId,
          assignmentId,
          title: 'Task 2',
          completed: false,
          order: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '3' as EntityId,
          assignmentId,
          title: 'Task 3',
          completed: true,
          order: 2,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const { result } = renderHook(() => useSubTaskProgressFromArray(subTasks));

      // 1/3 = 33.333...%, should round to 33%
      expect(result.current.completedCount).toBe(1);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.percentage).toBe(33);
    });

    it('should handle 1 sub-task completed out of 3', () => {
      const subTasks: SubTask[] = [
        {
          id: '1' as EntityId,
          assignmentId,
          title: 'Task 1',
          completed: true,
          order: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '2' as EntityId,
          assignmentId,
          title: 'Task 2',
          completed: false,
          order: 1,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '3' as EntityId,
          assignmentId,
          title: 'Task 3',
          completed: false,
          order: 2,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const { result } = renderHook(() => useSubTaskProgressFromArray(subTasks));

      expect(result.current.completedCount).toBe(1);
      expect(result.current.totalCount).toBe(3);
      expect(result.current.percentage).toBe(33);
    });

    it('should return isAllComplete = false when no sub-tasks exist', () => {
      const { result } = renderHook(() => useSubTaskProgressFromArray([]));

      expect(result.current.isAllComplete).toBe(false);
    });

    it('should be reactive to sub-tasks changes', () => {
      const { result, rerender } = renderHook(
        ({ subTasks }) => useSubTaskProgressFromArray(subTasks),
        {
          initialProps: {
            subTasks: [
              {
                id: '1' as EntityId,
                assignmentId,
                title: 'Task 1',
                completed: false,
                order: 0,
                createdAt: now,
                updatedAt: now,
              },
            ] as SubTask[],
          },
        },
      );

      expect(result.current.completedCount).toBe(0);
      expect(result.current.totalCount).toBe(1);

      // Rerender with completed sub-task
      rerender({
        subTasks: [
          {
            id: '1' as EntityId,
            assignmentId,
            title: 'Task 1',
            completed: true,
            order: 0,
            createdAt: now,
            updatedAt: now,
          },
        ] as SubTask[],
      });

      expect(result.current.completedCount).toBe(1);
      expect(result.current.totalCount).toBe(1);
      expect(result.current.isAllComplete).toBe(true);
    });
  });

  describe('useSubTaskProgressFromArray helper', () => {
    it('should calculate progress from any array of completed booleans', () => {
      const items = [{ completed: true }, { completed: false }, { completed: true }];

      const { result } = renderHook(() => useSubTaskProgressFromArray(items as SubTask[]));

      expect(result.current.completedCount).toBe(2);
      expect(result.current.totalCount).toBe(3);
      // 2/3 rounds to 67 (Math.round)
      expect(result.current.percentage).toBe(67);
    });

    it('should handle single completed item', () => {
      const items = [{ completed: true }];

      const { result } = renderHook(() => useSubTaskProgressFromArray(items as SubTask[]));

      expect(result.current.completedCount).toBe(1);
      expect(result.current.totalCount).toBe(1);
      expect(result.current.isAllComplete).toBe(true);
    });
  });
});

describe('SubTaskProgress edge cases', () => {
  it('should handle many sub-tasks', () => {
    const subTasks: SubTask[] = Array.from({ length: 100 }, (_, i) => ({
      id: `subtask-${i}` as EntityId,
      assignmentId,
      title: `Task ${i + 1}`,
      completed: i % 2 === 0, // 50% completed
      order: i,
      createdAt: now,
      updatedAt: now,
    }));

    const { result } = renderHook(() => useSubTaskProgressFromArray(subTasks));

    expect(result.current.completedCount).toBe(50);
    expect(result.current.totalCount).toBe(100);
    expect(result.current.percentage).toBe(50);
    expect(result.current.isAllComplete).toBe(false);
  });

  it('should handle single sub-task not completed', () => {
    const subTasks: SubTask[] = [
      {
        id: 'single' as EntityId,
        assignmentId,
        title: 'Single task',
        completed: false,
        order: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const { result } = renderHook(() => useSubTaskProgressFromArray(subTasks));

    expect(result.current.completedCount).toBe(0);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.percentage).toBe(0);
    expect(result.current.isAllComplete).toBe(false);
  });
});
