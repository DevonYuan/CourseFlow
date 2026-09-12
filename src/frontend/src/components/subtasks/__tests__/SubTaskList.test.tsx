/**
 * SubTaskList Component Tests
 *
 * Covers fetch-on-mount, loading skeleton, empty state, sorted rendering,
 * optimistic add + rollback, delete confirmation flow, and toggle.
 */

// @vitest-environment jsdom

import type { EntityId, IsoDateTime, SubTask } from '@backend/shared/types';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubTasks } from '../../../hooks/useSubTasks';
import { SubTaskList } from '../SubTaskList';

vi.mock('../../../hooks/useSubTasks', () => ({ useSubTasks: vi.fn() }));
vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    showToast: vi.fn(),
  }),
}));

const assignmentId = 'assignment-1' as EntityId;

function makeSubTask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    id: 'sub-1' as EntityId,
    assignmentId,
    title: 'Read chapter 1',
    completed: false,
    order: 0,
    createdAt: '2026-09-01T00:00:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-01T00:00:00.000Z' as IsoDateTime,
    ...overrides,
  };
}

function mockUseSubTasks(overrides: Record<string, unknown> = {}) {
  const api = {
    subTasks: [] as SubTask[],
    isLoading: false,
    error: null,
    fetchSubTasks: vi.fn().mockResolvedValue(undefined),
    addSubTask: vi.fn().mockResolvedValue({ ok: true, data: makeSubTask() }),
    deleteSubTask: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    toggleSubTask: vi.fn().mockResolvedValue({ ok: true, data: makeSubTask() }),
    optimisticAdd: vi.fn(),
    rollbackAdd: vi.fn(),
    optimisticRemove: vi.fn(),
    confirmRemove: vi.fn(),
    rollbackRemove: vi.fn(),
    getTempId: vi.fn(() => 'temp-1' as EntityId),
    ...overrides,
  };
  vi.mocked(useSubTasks).mockReturnValue(api as unknown as ReturnType<typeof useSubTasks>);
  return api;
}

describe('SubTaskList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('fetches sub-tasks on mount', () => {
    const api = mockUseSubTasks();

    render(<SubTaskList assignmentId={assignmentId} />);

    expect(api.fetchSubTasks).toHaveBeenCalledWith(assignmentId);
  });

  it('shows a loading state with skeletons', () => {
    mockUseSubTasks({ isLoading: true });

    render(<SubTaskList assignmentId={assignmentId} />);

    expect(screen.getByRole('status', { name: 'Loading sub-tasks' })).toBeInTheDocument();
  });

  it('shows the empty state when there are no sub-tasks', () => {
    mockUseSubTasks({ subTasks: [] });

    render(<SubTaskList assignmentId={assignmentId} />);

    expect(screen.getByText('No sub-tasks yet — add one below')).toBeInTheDocument();
  });

  it('renders sub-tasks sorted by order', () => {
    mockUseSubTasks({
      subTasks: [
        makeSubTask({ id: 'a' as EntityId, title: 'Second', order: 1 }),
        makeSubTask({ id: 'b' as EntityId, title: 'First', order: 0 }),
      ],
    });

    render(<SubTaskList assignmentId={assignmentId} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('First');
    expect(items[1]).toHaveTextContent('Second');
  });

  it('optimistically adds a sub-task and calls the API', async () => {
    const api = mockUseSubTasks();

    render(<SubTaskList assignmentId={assignmentId} />);
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Add sub-task' }),
      'New sub-task{Enter}',
    );

    expect(api.optimisticAdd).toHaveBeenCalled();
    expect(api.addSubTask).toHaveBeenCalledWith(assignmentId, 'New sub-task');
  });

  it('rolls back the optimistic add when the API fails', async () => {
    const api = mockUseSubTasks({
      addSubTask: vi.fn().mockResolvedValue({ ok: false, error: 'nope' }),
    });

    render(<SubTaskList assignmentId={assignmentId} />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Add sub-task' }), 'New{Enter}');

    await waitFor(() => expect(api.rollbackAdd).toHaveBeenCalledWith('temp-1'));
  });

  it('opens a confirmation modal when delete is clicked', async () => {
    mockUseSubTasks({ subTasks: [makeSubTask()] });

    render(<SubTaskList assignmentId={assignmentId} />);
    await userEvent.click(screen.getByRole('button', { name: /delete sub-task/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('deletes the sub-task after confirmation', async () => {
    const api = mockUseSubTasks({ subTasks: [makeSubTask()] });

    render(<SubTaskList assignmentId={assignmentId} />);
    await userEvent.click(screen.getByRole('button', { name: /delete sub-task/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteSubTask).toHaveBeenCalledWith('sub-1'));
  });

  it('toggles a sub-task via the row checkbox', async () => {
    const api = mockUseSubTasks({ subTasks: [makeSubTask()] });

    render(<SubTaskList assignmentId={assignmentId} />);
    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(api.toggleSubTask).toHaveBeenCalledWith('sub-1', true));
  });
});
