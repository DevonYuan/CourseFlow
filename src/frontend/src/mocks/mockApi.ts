/**
 * Mock API for Browser Development
 *
 * Provides a mock implementation of `window.api` for running the renderer
 * in a regular browser during development. This allows UI development
 * without needing the Electron main process.
 *
 * NOTE: This is ONLY for development. In production, the real `window.api`
 * is provided by the Electron preload script (src/backend/preload/index.ts).
 */

import type { IpcResult } from '@backend/shared/ipc';
import type {
  Assignment,
  AssignmentInput,
  SubTask,
  SubTaskInput,
  Note,
  NoteInput,
  PriorityOrder,
  PriorityOrderInput,
  Settings,
  ICalEvent,
  SchedulerStatus,
  EntityId,
  IsoDateTime,
} from '@backend/shared/types';

// In-memory mock database
const mockAssignments: Map<string, Assignment> = new Map();
const mockSubTasks: Map<string, SubTask[]> = new Map();
const mockNotes: Map<string, Note[]> = new Map();
const mockPriorityOrders: Map<string, PriorityOrder> = new Map();
let mockSettings: Settings = {
  theme: 'system',
  autoFetchIcal: false,
  icalFetchIntervalMinutes: 60,
  defaultPriority: 'medium',
  showCompletedAssignments: true,
  notifyDueSoon: true,
  dueSoonThresholdHours: 24,
  icalUrl: '',
  lastSyncAt: null,
  autoFetchIntervalMs: 60 * 60 * 1000,
  syncIntervalMinutes: 15,
};

// Module-level constants for mock data generation
const MOCK_NOW = Date.now();
const MOCK_DAY = 24 * 60 * 60 * 1000;

// Event listeners
type AnyCallback = (payload: unknown) => void;
const eventListeners: Map<string, Set<AnyCallback>> = new Map();

function emitEvent(eventName: string, payload: unknown): void {
  const listeners = eventListeners.get(eventName);
  if (listeners) {
    listeners.forEach((cb) => cb(payload));
  }
}

function createMockResult<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function createMockError(error: string, code?: string): IpcResult<never> {
  return { ok: false, error, code };
}

// Generate mock data
function generateMockAssignments(): Assignment[] {
  const now = MOCK_NOW;
  const day = MOCK_DAY;

  const assignments: Assignment[] = [
    {
      id: '1' as EntityId,
      title: 'Homework 1: Variables & Types',
      description: '<p>Complete exercises 1-10 in Chapter 2</p>',
      courseId: 'cs101' as EntityId,
      courseName: 'CS 101: Intro to Computer Science',
      courseColor: '#e8a838',
      dueAt: new Date(now + 2 * day).toISOString() as IsoDateTime,
      unlockAt: null,
      lockAt: null,
      pointsPossible: 100,
      submissionTypes: ['online_text_entry'],
      workflowState: 'published',
      htmlUrl: 'https://canvas.example.com/courses/1/assignments/1',
      icalUid: 'ical-uid-1@canvas.example.com',
      priority: 'high',
      status: 'pending',
      source: 'ical',
      sourceUrl: 'https://canvas.example.com/feeds/calendars/user_abc123.ics',
      rrule: undefined,
      createdAt: new Date(now - 5 * day).toISOString() as IsoDateTime,
      updatedAt: new Date(now - 1 * day).toISOString() as IsoDateTime,
    },
    {
      id: '2' as EntityId,
      title: 'Problem Set 3: Derivatives',
      description: '<p>Solve problems 1-15, show all work</p>',
      courseId: 'math200' as EntityId,
      courseName: 'MATH 200: Calculus II',
      courseColor: '#3b82f6',
      dueAt: new Date(now + 5 * day).toISOString() as IsoDateTime,
      unlockAt: null,
      lockAt: null,
      pointsPossible: 50,
      submissionTypes: ['online_upload'],
      workflowState: 'published',
      htmlUrl: 'https://canvas.example.com/courses/2/assignments/3',
      icalUid: 'ical-uid-2@canvas.example.com',
      priority: 'medium',
      status: 'pending',
      source: 'ical',
      sourceUrl: 'https://canvas.example.com/feeds/calendars/user_abc123.ics',
      rrule: undefined,
      createdAt: new Date(now - 3 * day).toISOString() as IsoDateTime,
      updatedAt: new Date(now - 2 * day).toISOString() as IsoDateTime,
    },
    {
      id: '3' as EntityId,
      title: 'Essay: The Great Gatsby Analysis',
      description: '<p>Write a 1500-word analysis of symbolism</p>',
      courseId: 'eng150' as EntityId,
      courseName: 'ENG 150: Academic Writing',
      courseColor: '#22c55e',
      dueAt: new Date(now + 10 * day).toISOString() as IsoDateTime,
      unlockAt: null,
      lockAt: null,
      pointsPossible: 200,
      submissionTypes: ['online_text_entry', 'online_upload'],
      workflowState: 'published',
      htmlUrl: 'https://canvas.example.com/courses/3/assignments/5',
      icalUid: 'ical-uid-3@canvas.example.com',
      priority: 'low',
      status: 'completed',
      source: 'ical',
      sourceUrl: 'https://canvas.example.com/feeds/calendars/user_abc123.ics',
      rrule: undefined,
      createdAt: new Date(MOCK_NOW - 7 * MOCK_DAY).toISOString() as IsoDateTime,
      updatedAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime,
    },
  ];

  // Populate priority orders
  assignments.forEach((a, i) => {
    mockPriorityOrders.set(a.id, {
      id: a.id as EntityId,
      assignmentId: a.id,
      order: i,
      updatedAt: new Date(MOCK_NOW).toISOString() as IsoDateTime,
    });
  });

  return assignments;
}

// Initialize mock data
const initialAssignments = generateMockAssignments();
initialAssignments.forEach((a) => mockAssignments.set(a.id, a));

// Mock sub-tasks
mockSubTasks.set('1', [
  { id: 'st-1-1' as EntityId, assignmentId: '1' as EntityId, title: 'Read Chapter 2', completed: true, order: 0, createdAt: new Date(MOCK_NOW - 4 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime },
  { id: 'st-1-2' as EntityId, assignmentId: '1' as EntityId, title: 'Complete exercises 1-5', completed: false, order: 1, createdAt: new Date(MOCK_NOW - 4 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime },
  { id: 'st-1-3' as EntityId, assignmentId: '1' as EntityId, title: 'Complete exercises 6-10', completed: false, order: 2, createdAt: new Date(MOCK_NOW - 4 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime },
]);

mockSubTasks.set('2', [
  { id: 'st-2-1' as EntityId, assignmentId: '2' as EntityId, title: 'Review derivative rules', completed: true, order: 0, createdAt: new Date(MOCK_NOW - 2 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime },
  { id: 'st-2-2' as EntityId, assignmentId: '2' as EntityId, title: 'Solve practice problems', completed: false, order: 1, createdAt: new Date(MOCK_NOW - 2 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime },
]);

mockSubTasks.set('3', [
  { id: 'st-3-1' as EntityId, assignmentId: '3' as EntityId, title: 'Outline essay structure', completed: true, order: 0, createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime },
  { id: 'st-3-2' as EntityId, assignmentId: '3' as EntityId, title: 'Write introduction', completed: true, order: 1, createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime },
  { id: 'st-3-3' as EntityId, assignmentId: '3' as EntityId, title: 'Write body paragraphs', completed: true, order: 2, createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime },
  { id: 'st-3-4' as EntityId, assignmentId: '3' as EntityId, title: 'Write conclusion', completed: true, order: 3, createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime },
  { id: 'st-3-5' as EntityId, assignmentId: '3' as EntityId, title: 'Proofread and cite sources', completed: true, order: 4, createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime },
]);

// Mock notes
mockNotes.set('1', [
  { id: 'note-1-1' as EntityId, assignmentId: '1' as EntityId, content: 'Started reading Chapter 2. Variables section is straightforward.', createdAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime },
  { id: 'note-1-2' as EntityId, assignmentId: '1' as EntityId, content: 'Finished exercises 1-5. Struggling with exercise 7 (loops).', createdAt: new Date(MOCK_NOW - 2 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 2 * MOCK_DAY).toISOString() as IsoDateTime },
]);

mockNotes.set('2', [
  { id: 'note-2-1' as EntityId, assignmentId: '2' as EntityId, content: 'Need to review chain rule before starting problem set.', createdAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime },
]);

mockNotes.set('3', [
  { id: 'note-3-1' as EntityId, assignmentId: '3' as EntityId, content: 'Thesis: The green light represents Gatsby\'s unattainable dreams.', createdAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime },
  { id: 'note-3-2' as EntityId, assignmentId: '3' as EntityId, content: 'Added quotes from Chapter 5 and 7. Essay complete.', createdAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime, updatedAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime },
]);

// Generate UUID
function generateId(): EntityId {
  return (Math.random().toString(36).slice(2, 15) + Math.random().toString(36).slice(2, 15)) as EntityId;
}

// Build mock API
const mockApi = {
  db: {
    assignments: {
      list: async (): Promise<IpcResult<Assignment[]>> => {
        await new Promise((r) => setTimeout(r, 100)); // Simulate network delay
        return createMockResult([...mockAssignments.values()].sort((a, b) => {
          const pa = mockPriorityOrders.get(a.id)?.order ?? 999;
          const pb = mockPriorityOrders.get(b.id)?.order ?? 999;
          return pa - pb;
        }));
      },
      get: async (id: string): Promise<IpcResult<Assignment | null>> => {
        await new Promise((r) => setTimeout(r, 50));
        return createMockResult(mockAssignments.get(id) ?? null);
      },
      upsert: async (input: AssignmentInput): Promise<IpcResult<Assignment>> => {
        await new Promise((r) => setTimeout(r, 50));
        const id = (input.id ?? generateId()) as EntityId;
        const now = new Date().toISOString() as IsoDateTime;
        const existing = mockAssignments.get(id);
        const assignment: Assignment = {
          id,
          title: input.title ?? existing?.title ?? '',
          description: input.description ?? existing?.description ?? '',
          courseId: (input.courseId ?? existing?.courseId ?? '') as EntityId,
          courseName: input.courseName ?? existing?.courseName ?? '',
          courseColor: input.courseColor ?? existing?.courseColor ?? '#6366f1',
          dueAt: input.dueAt ?? existing?.dueAt ?? null,
          unlockAt: input.unlockAt ?? existing?.unlockAt ?? null,
          lockAt: input.lockAt ?? existing?.lockAt ?? null,
          pointsPossible: input.pointsPossible ?? existing?.pointsPossible ?? null,
          submissionTypes: input.submissionTypes ?? existing?.submissionTypes ?? [],
          workflowState: input.workflowState ?? existing?.workflowState ?? 'published',
          htmlUrl: input.htmlUrl ?? existing?.htmlUrl ?? '',
          icalUid: input.icalUid ?? existing?.icalUid ?? '',
          priority: input.priority ?? existing?.priority ?? 'low',
          status: input.status ?? existing?.status ?? 'pending',
          source: input.source ?? existing?.source ?? 'manual',
          sourceUrl: input.sourceUrl ?? existing?.sourceUrl,
          rrule: input.rrule ?? existing?.rrule,
          createdAt: (input.createdAt ?? existing?.createdAt ?? now) as IsoDateTime,
          updatedAt: now,
        };
        mockAssignments.set(id, assignment);
        emitEvent('db:changed', { table: 'assignments', action: existing ? 'update' : 'insert', id: id as string });
        return createMockResult(assignment);
      },
      delete: async (id: string): Promise<IpcResult<void>> => {
        await new Promise((r) => setTimeout(r, 50));
        mockAssignments.delete(id);
        mockSubTasks.delete(id);
        mockNotes.delete(id);
        mockPriorityOrders.delete(id);
        emitEvent('db:changed', { table: 'assignments', action: 'delete', id });
        return createMockResult(undefined);
      },
    },
    subtasks: {
      list: async (assignmentId: string): Promise<IpcResult<SubTask[]>> => {
        await new Promise((r) => setTimeout(r, 50));
        return createMockResult(mockSubTasks.get(assignmentId) ?? []);
      },
      upsert: async (input: SubTaskInput): Promise<IpcResult<SubTask>> => {
        await new Promise((r) => setTimeout(r, 50));
        const id = generateId() as EntityId;
        const now = new Date().toISOString() as IsoDateTime;
        const subTask: SubTask = {
          id,
          assignmentId: input.assignmentId,
          title: input.title,
          completed: input.completed,
          order: input.order,
          createdAt: now,
          updatedAt: now,
        };
        const list = mockSubTasks.get(input.assignmentId) ?? [];
        list.push(subTask);
        mockSubTasks.set(input.assignmentId, list);
        emitEvent('db:changed', { table: 'sub_tasks', action: 'insert', id });
        return createMockResult(subTask);
      },
      delete: async (id: string): Promise<IpcResult<void>> => {
        await new Promise((r) => setTimeout(r, 50));
        mockSubTasks.forEach((list, assignmentId) => {
          const idx = list.findIndex((st) => st.id === id);
          if (idx !== -1) {
            list.splice(idx, 1);
            mockSubTasks.set(assignmentId, list);
          }
        });
        emitEvent('db:changed', { table: 'sub_tasks', action: 'delete', id });
        return createMockResult(undefined);
      },
      toggle: async (input: { id: string; completed: boolean }): Promise<IpcResult<SubTask>> => {
        await new Promise((r) => setTimeout(r, 50));
        let found: SubTask | null = null;
        mockSubTasks.forEach((list) => {
          const idx = list.findIndex((st) => st.id === input.id);
          if (idx !== -1) {
            const existing = list[idx]!; // idx is validated above
            const updated: SubTask = {
              id: existing.id,
              assignmentId: existing.assignmentId,
              title: existing.title,
              completed: input.completed,
              order: existing.order,
              createdAt: existing.createdAt,
              updatedAt: new Date().toISOString() as IsoDateTime,
            };
            list[idx] = updated;
            found = updated;
          }
        });
        if (!found) return createMockError('Sub-task not found', 'NOT_FOUND');
        emitEvent('db:changed', { table: 'sub_tasks', action: 'update', id: input.id });
        return createMockResult(found);
      },
    },
    notes: {
      list: async (assignmentId: string): Promise<IpcResult<Note[]>> => {
        await new Promise((r) => setTimeout(r, 50));
        return createMockResult(mockNotes.get(assignmentId) ?? []);
      },
      upsert: async (input: NoteInput): Promise<IpcResult<Note>> => {
        await new Promise((r) => setTimeout(r, 50));
        const id = generateId() as EntityId;
        const now = new Date().toISOString() as IsoDateTime;
        const note: Note = {
          id,
          assignmentId: input.assignmentId,
          content: input.content,
          createdAt: now,
          updatedAt: now,
        };
        const list = mockNotes.get(input.assignmentId) ?? [];
        list.unshift(note); // Newest first
        mockNotes.set(input.assignmentId, list);
        emitEvent('db:changed', { table: 'notes', action: 'insert', id });
        return createMockResult(note);
      },
      delete: async (id: string): Promise<IpcResult<void>> => {
        await new Promise((r) => setTimeout(r, 50));
        mockNotes.forEach((list, assignmentId) => {
          const idx = list.findIndex((n) => n.id === id);
          if (idx !== -1) {
            list.splice(idx, 1);
            mockNotes.set(assignmentId, list);
          }
        });
        emitEvent('db:changed', { table: 'notes', action: 'delete', id });
        return createMockResult(undefined);
      },
    },
    priority: {
      list: async (): Promise<IpcResult<PriorityOrder[]>> => {
        await new Promise((r) => setTimeout(r, 50));
        return createMockResult([...mockPriorityOrders.values()].sort((a, b) => a.order - b.order));
      },
      reorder: async (ids: string[]): Promise<IpcResult<void>> => {
        await new Promise((r) => setTimeout(r, 50));
        ids.forEach((id, index) => {
          const existing = mockPriorityOrders.get(id);
          if (existing) {
            mockPriorityOrders.set(id, { ...existing, order: index, updatedAt: new Date().toISOString() as IsoDateTime });
          }
        });
        ids.forEach((id) => emitEvent('db:changed', { table: 'priority_order', action: 'update', id }));
        return createMockResult(undefined);
      },
      upsert: async (input: PriorityOrderInput): Promise<IpcResult<PriorityOrder>> => {
        await new Promise((r) => setTimeout(r, 50));
        const now = new Date().toISOString() as IsoDateTime;
        const existing = mockPriorityOrders.get(input.assignmentId);
        const order: PriorityOrder = {
          id: input.assignmentId as EntityId,
          assignmentId: input.assignmentId,
          order: input.order,
          updatedAt: now,
        };
        mockPriorityOrders.set(input.assignmentId, order);
        emitEvent('db:changed', { table: 'priority_order', action: existing ? 'update' : 'insert', id: input.assignmentId });
        return createMockResult(order);
      },
    },
  },
  ical: {
    fetch: async (_url: string): Promise<IpcResult<ICalEvent[]>> => {
      await new Promise((r) => setTimeout(r, 500));
      return createMockResult([]);
    },
    import: async (_input: { events: ICalEvent[]; sourceUrl: string }): Promise<IpcResult<{ imported: number; updated: number; skipped: number }>> => {
      await new Promise((r) => setTimeout(r, 300));
      return createMockResult({ imported: 0, updated: 0, skipped: 0 });
    },
  },
  settings: {
    get: async (): Promise<IpcResult<Settings>> => {
      await new Promise((r) => setTimeout(r, 50));
      return createMockResult({ ...mockSettings });
    },
    set: async (partial: Partial<Settings>): Promise<IpcResult<Settings>> => {
      await new Promise((r) => setTimeout(r, 50));
      mockSettings = { ...mockSettings, ...partial };
      if (partial.icalFetchIntervalMinutes) {
        mockSettings.autoFetchIntervalMs = partial.icalFetchIntervalMinutes * 60 * 1000;
      }
      emitEvent('settings:changed', mockSettings);
      return createMockResult({ ...mockSettings });
    },
    reset: async (): Promise<IpcResult<Settings>> => {
      await new Promise((r) => setTimeout(r, 50));
      mockSettings = {
        theme: 'system',
        autoFetchIcal: false,
        icalFetchIntervalMinutes: 60,
        defaultPriority: 'medium',
        showCompletedAssignments: true,
        notifyDueSoon: true,
        dueSoonThresholdHours: 24,
        icalUrl: '',
        lastSyncAt: null,
        autoFetchIntervalMs: 60 * 60 * 1000,
        syncIntervalMinutes: 15,
      };
      emitEvent('settings:changed', mockSettings);
      return createMockResult({ ...mockSettings });
    },
  },
  app: {
    version: async (): Promise<IpcResult<string>> => {
      await new Promise((r) => setTimeout(r, 10));
      return createMockResult('0.1.0-dev');
    },
  },
  scheduler: {
    start: async (_intervalMinutes: number): Promise<IpcResult<SchedulerStatus>> => {
      await new Promise((r) => setTimeout(r, 50));
      return createMockResult({
        running: true,
        intervalMinutes: mockSettings.syncIntervalMinutes,
        lastRun: mockSettings.lastSyncAt,
        nextRun: new Date(Date.now() + mockSettings.syncIntervalMinutes * 60 * 1000).toISOString() as IsoDateTime,
        lastError: null,
      });
    },
    stop: async (): Promise<IpcResult<SchedulerStatus>> => {
      await new Promise((r) => setTimeout(r, 50));
      return createMockResult({
        running: false,
        intervalMinutes: mockSettings.syncIntervalMinutes,
        lastRun: mockSettings.lastSyncAt,
        nextRun: null,
        lastError: null,
      });
    },
    status: async (): Promise<IpcResult<SchedulerStatus>> => {
      await new Promise((r) => setTimeout(r, 50));
      return createMockResult({
        running: mockSettings.autoFetchIcal && !!mockSettings.icalUrl,
        intervalMinutes: mockSettings.syncIntervalMinutes,
        lastRun: mockSettings.lastSyncAt,
        nextRun: mockSettings.autoFetchIcal ? new Date(Date.now() + mockSettings.syncIntervalMinutes * 60 * 1000).toISOString() as IsoDateTime : null,
        lastError: null,
      });
    },
    trigger: async (): Promise<IpcResult<void>> => {
      await new Promise((r) => setTimeout(r, 500));
      return createMockResult(undefined);
    },
    onTick: (callback: (payload: { nextRun: string }) => void) => {
      const key = 'scheduler:tick';
      if (!eventListeners.has(key)) eventListeners.set(key, new Set());
      eventListeners.get(key)!.add(callback as AnyCallback);
      return () => eventListeners.get(key)?.delete(callback as AnyCallback);
    },
    onError: (callback: (payload: { message: string; code: string }) => void) => {
      const key = 'scheduler:error';
      if (!eventListeners.has(key)) eventListeners.set(key, new Set());
      eventListeners.get(key)!.add(callback as AnyCallback);
      return () => eventListeners.get(key)?.delete(callback as AnyCallback);
    },
    onCoalesced: (callback: (payload: { message: string }) => void) => {
      const key = 'scheduler:coalesced';
      if (!eventListeners.has(key)) eventListeners.set(key, new Set());
      eventListeners.get(key)!.add(callback as AnyCallback);
      return () => eventListeners.get(key)?.delete(callback as AnyCallback);
    },
  },
  onDbChanged: (callback: (payload: { table: string; action: string; id: string }) => void) => {
    const key = 'db:changed';
    if (!eventListeners.has(key)) eventListeners.set(key, new Set());
    eventListeners.get(key)!.add(callback as AnyCallback);
    return () => eventListeners.get(key)?.delete(callback as AnyCallback);
  },
  onIcalProgress: (callback: (payload: { stage: string; progress: number; message?: string }) => void) => {
    const key = 'ical:progress';
    if (!eventListeners.has(key)) eventListeners.set(key, new Set());
    eventListeners.get(key)!.add(callback as AnyCallback);
    return () => eventListeners.get(key)?.delete(callback as AnyCallback);
  },
  onSettingsChanged: (callback: (payload: Settings) => void) => {
    const key = 'settings:changed';
    if (!eventListeners.has(key)) eventListeners.set(key, new Set());
    eventListeners.get(key)!.add(callback as AnyCallback);
    return () => eventListeners.get(key)?.delete(callback as AnyCallback);
  },
  onSchedulerTick: (callback: (payload: { nextRun: string }) => void) => {
    return mockApi.scheduler.onTick(callback);
  },
  onSchedulerError: (callback: (payload: { message: string; code: string }) => void) => {
    return mockApi.scheduler.onError(callback);
  },
} as const;

// Install mock API if window.api doesn't exist (browser dev mode)
if (typeof window !== 'undefined' && !window.api) {
  // @ts-expect-error - intentionally adding mock for dev
  window.api = mockApi;
  // console.log('[Mock API] Installed mock window.api for browser development');
}

export { mockApi };
export type MockApi = typeof mockApi;