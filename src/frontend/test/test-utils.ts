/**
 * Test Utilities — Factories and Mock Helpers
 *
 * Provides factory functions for creating mock data and helper functions
 * for testing. Used across unit, component, and integration tests.
 *
 * @module @frontend/test/test-utils
 */

import type {
  Assignment,
  AssignmentInput,
  SubTask,
  SubTaskInput,
  Note,
  NoteInput,
  EntityId,
  IsoDateTime,
  ICalEvent,
  ImportResult,
  Settings,
  Page,
  PageTreeNode,
  PageSearchResult,
} from '@backend/shared/types';
import { vi } from 'vitest';

// ============================================================================
// Entity Factories
// ============================================================================

/**
 * Creates a mock Assignment object for testing.
 * @param overrides - Partial fields to override defaults
 */
export function createMockAssignment(overrides: Partial<Assignment> = {}): Assignment {
  const now = Date.now();
  const id = `assignment-${now}-${Math.random().toString(36).slice(2, 8)}` as EntityId;

  return {
    id,
    title: 'Test Assignment',
    description: 'Test assignment description',
    courseId: 'course-1' as EntityId,
    courseName: 'Test Course',
    courseColor: '#6366f1',
    dueAt: new Date(now + 86_400_000).toISOString() as IsoDateTime, // +1 day
    unlockAt: null,
    lockAt: null,
    pointsPossible: 100,
    submissionTypes: ['online_text_entry'],
    workflowState: 'published',
    htmlUrl: 'https://canvas.example.com/assignments/1',
    icalUid: `uid-${id}`,
    priority: 'medium',
    status: 'pending',
    source: 'ical',
    sourceUrl: 'https://canvas.example.com/feeds/test.ics',
    rrule: undefined,
    createdAt: new Date(now - 86_400_000).toISOString() as IsoDateTime,
    updatedAt: new Date(now).toISOString() as IsoDateTime,
    ...overrides,
  };
}

/**
 * Creates a mock AssignmentInput for testing upsert operations.
 * @param overrides - Partial fields to override defaults
 */
export function createMockAssignmentInput(
  overrides: Partial<AssignmentInput> = {},
): AssignmentInput {
  const assignment = createMockAssignment(overrides);
  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    courseId: assignment.courseId,
    courseName: assignment.courseName,
    courseColor: assignment.courseColor,
    dueAt: assignment.dueAt,
    unlockAt: assignment.unlockAt,
    lockAt: assignment.lockAt,
    pointsPossible: assignment.pointsPossible,
    submissionTypes: assignment.submissionTypes,
    workflowState: assignment.workflowState,
    htmlUrl: assignment.htmlUrl,
    icalUid: assignment.icalUid,
    priority: assignment.priority,
    status: assignment.status,
    source: assignment.source,
    sourceUrl: assignment.sourceUrl,
    rrule: assignment.rrule,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
    ...overrides,
  };
}

/**
 * Creates a mock SubTask object for testing.
 * @param overrides - Partial fields to override defaults
 */
export function createMockSubTask(overrides: Partial<SubTask> = {}): SubTask {
  const now = new Date().toISOString() as IsoDateTime;
  const id = `subtask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as EntityId;

  return {
    id,
    assignmentId: overrides.assignmentId ?? (`assignment-${Date.now()}` as EntityId),
    title: 'Test sub-task',
    completed: false,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a mock SubTaskInput for testing sub-task creation.
 * @param overrides - Partial fields to override defaults
 */
export function createMockSubTaskInput(overrides: Partial<SubTaskInput> = {}): SubTaskInput {
  return {
    assignmentId: overrides.assignmentId ?? (`assignment-${Date.now()}` as EntityId),
    title: overrides.title ?? 'Test sub-task',
    completed: overrides.completed ?? false,
    order: overrides.order ?? 0,
  };
}

/**
 * Creates a mock Note object for testing.
 * @param overrides - Partial fields to override defaults
 */
export function createMockNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString() as IsoDateTime;
  const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as EntityId;

  return {
    id,
    assignmentId: overrides.assignmentId ?? (`assignment-${Date.now()}` as EntityId),
    content: overrides.content ?? 'Test note content',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Creates a mock NoteInput for testing note creation.
 * @param overrides - Partial fields to override defaults
 */
export function createMockNoteInput(overrides: Partial<NoteInput> = {}): NoteInput {
  return {
    assignmentId: overrides.assignmentId ?? (`assignment-${Date.now()}` as EntityId),
    content: overrides.content ?? 'Test note content',
    ...overrides,
  };
}

/**
 * Creates a mock Page object (Notes workspace) for testing.
 * @param overrides - Partial fields to override defaults
 */
export function createMockPage(overrides: Partial<Page> = {}): Page {
  const now = new Date().toISOString() as IsoDateTime;
  const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` as EntityId;

  return {
    id,
    parentId: null,
    title: 'Test Page',
    content: 'Test page content',
    icon: '📄',
    cover: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    ...overrides,
  };
}

/**
 * Builds a PageTreeNode from a page and optional children.
 */
export function createMockPageNode(
  page: Page = createMockPage(),
  children: PageTreeNode[] = [],
): PageTreeNode {
  return { page, children };
}

/**
 * Creates a mock ICalEvent for testing iCal operations.
 * @param overrides - Partial fields to override defaults
 */
export function createMockICalEvent(overrides: Partial<ICalEvent> = {}): ICalEvent {
  const now = Date.now();
  return {
    uid: `uid-${now}-${Math.random().toString(36).slice(2, 8)}`,
    summary: 'Test Event',
    description: 'Test description',
    location: 'Test Location',
    dtStart: new Date(now).toISOString() as IsoDateTime,
    dtEnd: new Date(now + 3_600_000).toISOString() as IsoDateTime, // +1 hour
    rrule: null,
    url: 'https://example.com/event',
    categories: ['TestCourse'],
    ...overrides,
  };
}

/**
 * Creates a mock ImportResult for testing.
 * @param overrides - Partial fields to override defaults
 */
export function createMockImportResult(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    imported: overrides.imported ?? 1,
    updated: overrides.updated ?? 0,
    skipped: overrides.skipped ?? 0,
    ...overrides,
  };
}

/**
 * Creates a mock Settings object for testing.
 * @param overrides - Partial fields to override defaults
 */
export function createMockSettings(overrides: Partial<Settings> = {}): Settings {
  return {
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
    ...overrides,
  };
}

// ============================================================================
// Test Constants
// ============================================================================

export const TEST_ASSIGNMENT_ID = 'assignment-test-123' as EntityId;
export const TEST_SUBTASK_ID = 'subtask-test-123' as EntityId;
export const TEST_NOTE_ID = 'note-test-123' as EntityId;

// ============================================================================
// Mock API Helpers
// ============================================================================

/**
 * Creates a mock window.api object for testing.
 * @param overrides - Partial mock API to override defaults
 */
export function createMockApi(overrides: Record<string, unknown> = {}) {
  const defaultApi = {
    db: {
      assignments: {
        list: async () => ({ ok: true, data: [] as Assignment[] }),
        get: async () => ({ ok: true, data: null as Assignment | null }),
        upsert: async () => ({ ok: true, data: {} as Assignment }),
        delete: async () => ({ ok: true, data: undefined }),
      },
      subtasks: {
        list: async () => ({ ok: true, data: [] as SubTask[] }),
        get: async () => ({ ok: true, data: null as SubTask | null }),
        upsert: async () => ({ ok: true, data: {} as SubTask }),
        delete: async () => ({ ok: true, data: undefined }),
        toggle: async () => ({ ok: true, data: {} as SubTask }),
      },
      notes: {
        list: async () => ({ ok: true, data: [] as Note[] }),
        get: async () => ({ ok: true, data: null as Note | null }),
        upsert: async () => ({ ok: true, data: {} as Note }),
        delete: async () => ({ ok: true, data: undefined }),
      },
      priority: {
        list: async () => ({ ok: true, data: [] as unknown[] }),
        reorder: async () => ({ ok: true, data: undefined }),
        upsert: async () => ({ ok: true, data: {} as unknown }),
      },
      pages: {
        list: async () => ({ ok: true, data: [] as Page[] }),
        get: async () => ({ ok: true, data: null as Page | null }),
        tree: async () => ({ ok: true, data: [] as PageTreeNode[] }),
        create: async () => ({ ok: true, data: createMockPage() }),
        update: async () => ({ ok: true, data: createMockPage() }),
        delete: async () => ({ ok: true, data: undefined }),
        move: async () => ({ ok: true, data: createMockPage() }),
        search: async () => ({ ok: true, data: [] as PageSearchResult[] }),
      },
    },
    settings: {
      get: async () => ({ ok: true, data: createMockSettings() }),
      set: async () => ({ ok: true, data: createMockSettings() }),
      reset: async () => ({ ok: true, data: createMockSettings() }),
    },
    ical: {
      fetch: async () => ({ ok: true, data: [] as ICalEvent[] }),
      import: async () => ({ ok: true, data: createMockImportResult() }),
    },
    scheduler: {
      start: async () => ({ ok: true, data: {} as unknown }),
      stop: async () => ({ ok: true, data: {} as unknown }),
      status: async () => ({ ok: true, data: {} as unknown }),
      trigger: async () => ({ ok: true, data: undefined }),
    },
    on: vi.fn(),
    onDbChanged: vi.fn((cb) => cb),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    removeListener: vi.fn(),
  };

  return new Proxy(defaultApi, {
    get(target, prop) {
      if (typeof prop === 'string' && prop in overrides) {
        return overrides[prop];
      }
      return target[prop as keyof typeof defaultApi];
    },
  });
}

/**
 * Sets up window.api mock for tests.
 */
export function setupWindowApiMock(mockOverrides: Record<string, unknown> = {}) {
  const mockApi = createMockApi(mockOverrides);
  Object.defineProperty(window, 'api', {
    value: mockApi,
    writable: true,
    configurable: true,
  });
  return mockApi;
}

/**
 * Creates a mock for db:changed event callbacks.
 */
export function createDbChangedMock() {
  const listeners: Array<(payload: unknown) => void> = [];
  return {
    on: ((event: string, cb: (payload: unknown) => void) => {
      if (event === 'db:changed') {
        listeners.push(cb);
      }
    }) as (event: string, cb: (payload: unknown) => void) => void,
    emit: (payload: unknown) => {
      listeners.forEach((cb) => cb(payload));
    },
  };
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generates multiple mock assignments for testing.
 */
export function generateMockAssignments(count: number, baseDate: Date = new Date()): Assignment[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockAssignment({
      title: `Assignment ${i + 1}`,
      dueAt: new Date(baseDate.getTime() + i * 86_400_000).toISOString() as IsoDateTime,
    });
  });
}

/**
 * Generates multiple mock sub-tasks for an assignment.
 */
export function generateMockSubTasks(assignmentId: EntityId, count: number): SubTask[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockSubTask({
      assignmentId,
      title: `Sub-task ${i + 1}`,
      order: i,
      completed: i % 2 === 0, // Alternate completed
    });
  });
}

/**
 * Generates multiple mock notes for an assignment.
 */
export function generateMockNotes(assignmentId: EntityId, count: number): Note[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockNote({
      assignmentId,
      content: `Note ${i + 1} content`,
    });
  });
}
