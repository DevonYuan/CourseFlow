/**
 * CalendarList Component Tests
 *
 * Regression coverage for the "stuck on loading skeleton" bug: the list used to
 * re-fetch on mount whenever `calendars.length === 0`, which looped forever once
 * a fetch completed with an empty result (the loading flag flips back to false
 * while the list is still empty, re-satisfying the effect condition). The store
 * now exposes `hasFetched` so an empty list is a stable, fully-loaded state.
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { CalendarSource, EntityId, IsoDateTime } from '@backend/shared/types';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../../context/ToastContext';
import { useCalendarsStore } from '../../../stores/calendarsStore';
import { CalendarList } from '../CalendarList';

// Extend expect with jest-dom matchers
expect.extend(matchers);

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };

const listMock = vi.fn<() => Promise<Result<CalendarSource[]>>>(async () => ({ ok: true, data: [] }));

const mockApi = {
  db: {
    calendars: {
      list: listMock,
      get: async () => ({ ok: true, data: null as CalendarSource | null }),
    },
  },
  onDbChanged: vi.fn<(cb: (payload: IpcEvents['db:changed']) => void) => () => void>(),
};

Object.defineProperty(window, 'api', { value: mockApi, writable: true, configurable: true });

function createMockCalendar(overrides: Partial<CalendarSource> = {}): CalendarSource {
  const now = '2026-01-01T00:00:00.000Z' as IsoDateTime;
  return {
    id: 'cal-1' as EntityId,
    name: 'Canvas',
    feedUrl: 'encrypted',
    enabled: true,
    color: '#3b82f6',
    position: 0,
    lastSyncAt: null,
    nextSyncAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function resetStore(): void {
  useCalendarsStore.setState({
    calendars: [],
    isLoading: false,
    hasFetched: false,
    error: null,
    _previousCalendars: null,
    _previousState: null,
  });
}

function renderList(): void {
  render(
    <ToastProvider>
      <CalendarList onAddCalendar={vi.fn()} onDeleteCalendar={vi.fn()} />
    </ToastProvider>,
  );
}

describe('CalendarList', () => {
  beforeEach(() => {
    resetStore();
    listMock.mockClear();
    listMock.mockResolvedValue({ ok: true, data: [] });
    mockApi.onDbChanged.mockReturnValue(() => {});
  });

  afterEach(() => {
    cleanup();
    resetStore();
  });

  it('fetches calendars once and settles on the empty state (no refetch loop)', async () => {
    renderList();

    // The empty state is the terminal UI state — it must appear after the
    // (empty) fetch resolves rather than the skeleton re-appearing.
    expect(await screen.findByText('No calendars configured yet.')).toBeInTheDocument();

    // Give any runaway effect loop a chance to fire again before asserting.
    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    expect(useCalendarsStore.getState().hasFetched).toBe(true);
    expect(useCalendarsStore.getState().isLoading).toBe(false);
  });

  it('renders one row per calendar with its color badge', async () => {
    listMock.mockResolvedValue({
      ok: true,
      data: [
        createMockCalendar({ id: 'cal-1' as EntityId, name: 'Canvas', color: '#3b82f6' }),
        createMockCalendar({
          id: 'cal-2' as EntityId,
          name: 'Outlook',
          color: '#ef4444',
          position: 1,
        }),
      ],
    });

    renderList();

    expect(await screen.findByText('Canvas')).toBeInTheDocument();
    expect(screen.getByText('Outlook')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-row-cal-1')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-row-cal-2')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('does not re-fetch when the store already completed a load', async () => {
    useCalendarsStore.setState({ hasFetched: true, calendars: [createMockCalendar()] });

    renderList();

    expect(await screen.findByText('Canvas')).toBeInTheDocument();
    expect(listMock).not.toHaveBeenCalled();
  });
});
