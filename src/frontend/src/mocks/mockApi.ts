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
  Page,
  PageInput,
  PageUpdateInput,
  PageTreeNode,
  PageSearchResult,
  CalendarSource,
  CalendarSourceInput,
  CalendarSourceUpdateInput,
} from '@backend/shared/types';

// In-memory mock database
const mockAssignments: Map<string, Assignment> = new Map();
const mockSubTasks: Map<string, SubTask[]> = new Map();
const mockNotes: Map<string, Note[]> = new Map();
const mockPriorityOrders: Map<string, PriorityOrder> = new Map();
const mockCalendars: Map<string, CalendarSource> = new Map();
const mockPages: Map<string, Page> = new Map();
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
  {
    id: 'st-1-1' as EntityId,
    assignmentId: '1' as EntityId,
    title: 'Read Chapter 2',
    completed: true,
    order: 0,
    createdAt: new Date(MOCK_NOW - 4 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime,
  },
  {
    id: 'st-1-2' as EntityId,
    assignmentId: '1' as EntityId,
    title: 'Complete exercises 1-5',
    completed: false,
    order: 1,
    createdAt: new Date(MOCK_NOW - 4 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime,
  },
  {
    id: 'st-1-3' as EntityId,
    assignmentId: '1' as EntityId,
    title: 'Complete exercises 6-10',
    completed: false,
    order: 2,
    createdAt: new Date(MOCK_NOW - 4 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime,
  },
]);

mockSubTasks.set('2', [
  {
    id: 'st-2-1' as EntityId,
    assignmentId: '2' as EntityId,
    title: 'Review derivative rules',
    completed: true,
    order: 0,
    createdAt: new Date(MOCK_NOW - 2 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime,
  },
  {
    id: 'st-2-2' as EntityId,
    assignmentId: '2' as EntityId,
    title: 'Solve practice problems',
    completed: false,
    order: 1,
    createdAt: new Date(MOCK_NOW - 2 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime,
  },
]);

mockSubTasks.set('3', [
  {
    id: 'st-3-1' as EntityId,
    assignmentId: '3' as EntityId,
    title: 'Outline essay structure',
    completed: true,
    order: 0,
    createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime,
  },
  {
    id: 'st-3-2' as EntityId,
    assignmentId: '3' as EntityId,
    title: 'Write introduction',
    completed: true,
    order: 1,
    createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime,
  },
  {
    id: 'st-3-3' as EntityId,
    assignmentId: '3' as EntityId,
    title: 'Write body paragraphs',
    completed: true,
    order: 2,
    createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime,
  },
  {
    id: 'st-3-4' as EntityId,
    assignmentId: '3' as EntityId,
    title: 'Write conclusion',
    completed: true,
    order: 3,
    createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime,
  },
  {
    id: 'st-3-5' as EntityId,
    assignmentId: '3' as EntityId,
    title: 'Proofread and cite sources',
    completed: true,
    order: 4,
    createdAt: new Date(MOCK_NOW - 6 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime,
  },
]);

// Mock notes
mockNotes.set('1', [
  {
    id: 'note-1-1' as EntityId,
    assignmentId: '1' as EntityId,
    content: 'Started reading Chapter 2. Variables section is straightforward.',
    createdAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 3 * MOCK_DAY).toISOString() as IsoDateTime,
  },
  {
    id: 'note-1-2' as EntityId,
    assignmentId: '1' as EntityId,
    content: 'Finished exercises 1-5. Struggling with exercise 7 (loops).',
    createdAt: new Date(MOCK_NOW - 2 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 2 * MOCK_DAY).toISOString() as IsoDateTime,
  },
]);

mockNotes.set('2', [
  {
    id: 'note-2-1' as EntityId,
    assignmentId: '2' as EntityId,
    content: 'Need to review chain rule before starting problem set.',
    createdAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime,
  },
]);

mockNotes.set('3', [
  {
    id: 'note-3-1' as EntityId,
    assignmentId: '3' as EntityId,
    content: "Thesis: The green light represents Gatsby's unattainable dreams.",
    createdAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 5 * MOCK_DAY).toISOString() as IsoDateTime,
  },
  {
    id: 'note-3-2' as EntityId,
    assignmentId: '3' as EntityId,
    content: 'Added quotes from Chapter 5 and 7. Essay complete.',
    createdAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime,
    updatedAt: new Date(MOCK_NOW - 1 * MOCK_DAY).toISOString() as IsoDateTime,
  },
]);

// ---------------------------------------------------------------------------
// Pages (Notes workspace)
// ---------------------------------------------------------------------------

/** Collect the ids of every descendant of a page (excluding the page itself). */
function collectPageDescendants(pageId: string): string[] {
  const result: string[] = [];
  for (const page of mockPages.values()) {
    if ((page.parentId ?? null) === pageId) {
      result.push(page.id, ...collectPageDescendants(page.id));
    }
  }
  return result;
}

/** Next position for a new sibling under `parentId`. */
function nextPagePosition(parentId: string | null): number {
  const siblings = [...mockPages.values()].filter((p) => (p.parentId ?? null) === parentId);
  return siblings.length === 0 ? 0 : Math.max(...siblings.map((p) => p.position)) + 1;
}

/** Build the hierarchical page tree from the flat mock store. */
function buildPageTree(): PageTreeNode[] {
  const childrenMap = new Map<string | null, Page[]>();
  for (const page of mockPages.values()) {
    const key = page.parentId ?? null;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(page);
  }
  const build = (parentId: string | null): PageTreeNode[] =>
    (childrenMap.get(parentId) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((page) => ({ page, children: build(page.id) }));
  return build(null);
}

/** Escape snippet text before injecting the `<mark>` highlight. */
function escapeSnippetText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Build a highlighted `…before<mark>match</mark>after…` snippet. */
function buildMockSnippet(text: string, query: string): string {
  const source = text || '';
  const index = source.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return escapeSnippetText(source.slice(0, 80));
  const start = Math.max(0, index - 30);
  const end = Math.min(source.length, index + query.length + 30);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  return `${prefix}${escapeSnippetText(source.slice(start, index))}<mark>${escapeSnippetText(
    source.slice(index, index + query.length),
  )}</mark>${escapeSnippetText(source.slice(index + query.length, end))}${suffix}`;
}

/** Seed a small deterministic page tree for browser dev + e2e tests. */
function seedMockPages(): void {
  const now = new Date(MOCK_NOW).toISOString() as IsoDateTime;
  const pages: Page[] = [
    {
      id: 'page-1' as EntityId,
      parentId: null,
      title: 'Class Notes',
      content: '# Class Notes\n\nWelcome to your notebook.',
      icon: '📚',
      cover: null,
      position: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
    },
    {
      id: 'page-2' as EntityId,
      parentId: 'page-1' as EntityId,
      title: 'Lecture 1',
      content: '# Lecture 1\n\nVariables and types.',
      icon: '📄',
      cover: null,
      position: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
    },
    {
      id: 'page-3' as EntityId,
      parentId: 'page-1' as EntityId,
      title: 'Lecture 2',
      content: null,
      icon: '📄',
      cover: null,
      position: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
    },
    {
      id: 'page-4' as EntityId,
      parentId: null,
      title: 'Ideas',
      content: null,
      icon: '📁',
      cover: null,
      position: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
    },
    {
      id: 'page-5' as EntityId,
      parentId: 'page-4' as EntityId,
      title: 'Project Sketch',
      content: 'A rough sketch of the project.',
      icon: '📝',
      cover: null,
      position: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
    },
  ];
  for (const page of pages) mockPages.set(page.id, page);
}
seedMockPages();

// Generate UUID
function generateId(): EntityId {
  return (Math.random().toString(36).slice(2, 15) +
    Math.random().toString(36).slice(2, 15)) as EntityId;
}

// Build mock API
const mockApi = {
  db: {
    assignments: {
      list: async (): Promise<IpcResult<Assignment[]>> => {
        await new Promise((r) => setTimeout(r, 100)); // Simulate network delay
        return createMockResult(
          [...mockAssignments.values()].sort((a, b) => {
            const pa = mockPriorityOrders.get(a.id)?.order ?? 999;
            const pb = mockPriorityOrders.get(b.id)?.order ?? 999;
            return pa - pb;
          }),
        );
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
        emitEvent('db:changed', {
          table: 'assignments',
          action: existing ? 'update' : 'insert',
          id: id as string,
        });
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
        const now = new Date().toISOString() as IsoDateTime;

        // Update existing note when an id is provided (1:N model).
        if (input.id) {
          let updated: Note | null = null;
          mockNotes.forEach((list) => {
            const idx = list.findIndex((n) => n.id === input.id);
            if (idx !== -1) {
              const existing = list[idx]!;
              const next: Note = { ...existing, content: input.content, updatedAt: now };
              list[idx] = next;
              updated = next;
            }
          });
          if (!updated) return createMockError('Note not found', 'NOT_FOUND');
          emitEvent('db:changed', { table: 'notes', action: 'update', id: input.id });
          return createMockResult(updated);
        }

        const id = generateId() as EntityId;
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
            mockPriorityOrders.set(id, {
              ...existing,
              order: index,
              updatedAt: new Date().toISOString() as IsoDateTime,
            });
          }
        });
        ids.forEach((id) =>
          emitEvent('db:changed', { table: 'priority_order', action: 'update', id }),
        );
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
        emitEvent('db:changed', {
          table: 'priority_order',
          action: existing ? 'update' : 'insert',
          id: input.assignmentId,
        });
        return createMockResult(order);
      },
    },
    calendars: {
      list: async (): Promise<IpcResult<CalendarSource[]>> => {
        await new Promise((r) => setTimeout(r, 100));
        return createMockResult([...mockCalendars.values()].sort((a, b) => a.position - b.position));
      },
      get: async (id: string): Promise<IpcResult<CalendarSource | null>> => {
        await new Promise((r) => setTimeout(r, 50));
        return createMockResult(mockCalendars.get(id) ?? null);
      },
      create: async (input: CalendarSourceInput): Promise<IpcResult<CalendarSource>> => {
        await new Promise((r) => setTimeout(r, 50));
        const now = new Date().toISOString() as IsoDateTime;
        const id = generateId() as EntityId;
        const calendar: CalendarSource = {
          id,
          name: input.name,
          feedUrl: input.feedUrl, // In mock, store as-is
          enabled: input.enabled ?? true,
          color: input.color ?? '#3b82f6',
          position: input.position ?? mockCalendars.size,
          lastSyncAt: null,
          nextSyncAt: null,
          lastError: null,
          createdAt: now,
          updatedAt: now,
        };
        mockCalendars.set(id, calendar);
        emitEvent('db:changed', { table: 'calendars', action: 'insert', id });
        return createMockResult(calendar);
      },
      update: async (input: CalendarSourceUpdateInput): Promise<IpcResult<CalendarSource>> => {
        await new Promise((r) => setTimeout(r, 50));
        const existing = mockCalendars.get(input.id);
        if (!existing) return createMockError('Calendar not found', 'NOT_FOUND');
        const now = new Date().toISOString() as IsoDateTime;
        const updated: CalendarSource = {
          ...existing,
          name: input.name ?? existing.name,
          feedUrl: input.feedUrl ?? existing.feedUrl,
          enabled: input.enabled ?? existing.enabled,
          color: input.color ?? existing.color,
          position: input.position ?? existing.position,
          updatedAt: now,
        };
        mockCalendars.set(input.id, updated);
        emitEvent('db:changed', { table: 'calendars', action: 'update', id: input.id });
        return createMockResult(updated);
      },
      delete: async (id: string): Promise<IpcResult<void>> => {
        await new Promise((r) => setTimeout(r, 50));
        mockCalendars.delete(id);
        emitEvent('db:changed', { table: 'calendars', action: 'delete', id });
        return createMockResult(undefined);
      },
      reorder: async (ids: string[]): Promise<IpcResult<void>> => {
        await new Promise((r) => setTimeout(r, 50));
        ids.forEach((id, index) => {
          const existing = mockCalendars.get(id);
          if (existing) {
            mockCalendars.set(id, {
              ...existing,
              position: index,
              updatedAt: new Date().toISOString() as IsoDateTime,
            });
          }
        });
        ids.forEach((id) =>
          emitEvent('db:changed', { table: 'calendars', action: 'update', id }),
        );
        return createMockResult(undefined);
      },
      setEnabled: async (input: { id: string; enabled: boolean }): Promise<IpcResult<void>> => {
        await new Promise((r) => setTimeout(r, 50));
        const existing = mockCalendars.get(input.id);
        if (!existing) return createMockError('Calendar not found', 'NOT_FOUND');
        const now = new Date().toISOString() as IsoDateTime;
        mockCalendars.set(input.id, {
          ...existing,
          enabled: input.enabled,
          updatedAt: now,
        });
        emitEvent('db:changed', { table: 'calendars', action: 'update', id: input.id });
        return createMockResult(undefined);
      },
    },
    pages: {
      list: async (parentId?: string): Promise<IpcResult<Page[]>> => {
        await new Promise((r) => setTimeout(r, 30));
        const pages = [...mockPages.values()]
          .filter((p) => (p.parentId ?? null) === (parentId ?? null))
          .sort((a, b) => a.position - b.position);
        return createMockResult(pages);
      },
      get: async (id: string): Promise<IpcResult<Page | null>> => {
        await new Promise((r) => setTimeout(r, 30));
        return createMockResult(mockPages.get(id) ?? null);
      },
      tree: async (): Promise<IpcResult<PageTreeNode[]>> => {
        await new Promise((r) => setTimeout(r, 50));
        return createMockResult(buildPageTree());
      },
      create: async (input: PageInput): Promise<IpcResult<Page>> => {
        await new Promise((r) => setTimeout(r, 50));
        const now = new Date().toISOString() as IsoDateTime;
        const parentId = input.parentId ?? null;
        const page: Page = {
          id: generateId(),
          parentId,
          title: input.title || 'Untitled',
          content: input.content ?? null,
          icon: input.icon ?? null,
          cover: input.cover ?? null,
          position: input.position ?? nextPagePosition(parentId),
          createdAt: now,
          updatedAt: now,
          createdBy: null,
        };
        mockPages.set(page.id, page);
        emitEvent('db:changed', { table: 'pages', action: 'insert', id: page.id });
        return createMockResult(page);
      },
      update: async (input: PageUpdateInput): Promise<IpcResult<Page>> => {
        await new Promise((r) => setTimeout(r, 40));
        const existing = mockPages.get(input.id);
        if (!existing) return createMockError('Page not found', 'NOT_FOUND');
        const updated: Page = {
          ...existing,
          title: input.title ?? existing.title,
          content: input.content === undefined ? existing.content : input.content,
          parentId: input.parentId === undefined ? existing.parentId : input.parentId,
          position: input.position ?? existing.position,
          icon: input.icon === undefined ? existing.icon : input.icon,
          cover: input.cover === undefined ? existing.cover : input.cover,
          updatedAt: new Date().toISOString() as IsoDateTime,
        };
        mockPages.set(updated.id, updated);
        emitEvent('db:changed', { table: 'pages', action: 'update', id: updated.id });
        return createMockResult(updated);
      },
      delete: async (id: string): Promise<IpcResult<void>> => {
        await new Promise((r) => setTimeout(r, 40));
        for (const pageId of [id, ...collectPageDescendants(id)]) {
          mockPages.delete(pageId);
        }
        emitEvent('db:changed', { table: 'pages', action: 'delete', id });
        return createMockResult(undefined);
      },
      move: async (input: {
        id: string;
        parentId: string | null;
        position: number;
      }): Promise<IpcResult<Page>> => {
        await new Promise((r) => setTimeout(r, 40));
        const page = mockPages.get(input.id);
        if (!page) return createMockError('Page not found', 'NOT_FOUND');
        const parentId = (input.parentId ?? null) as EntityId | null;
        if (
          parentId === input.id ||
          (parentId !== null && collectPageDescendants(input.id).includes(parentId))
        ) {
          return createMockError(
            'Cannot move a page into its own descendant (circular reference)',
            'VALIDATION_ERROR',
          );
        }
        const now = new Date().toISOString() as IsoDateTime;
        const oldParentId = page.parentId ?? null;

        // Renumber the remaining old siblings.
        const oldSiblings = [...mockPages.values()]
          .filter((p) => p.id !== input.id && (p.parentId ?? null) === oldParentId)
          .sort((a, b) => a.position - b.position);
        oldSiblings.forEach((p, index) => mockPages.set(p.id, { ...p, position: index }));

        // Insert at the requested position among the new siblings.
        const newSiblings = [...mockPages.values()]
          .filter((p) => p.id !== input.id && (p.parentId ?? null) === parentId)
          .sort((a, b) => a.position - b.position);
        const clamped = Math.max(0, Math.min(input.position, newSiblings.length));
        const ordered = [
          ...newSiblings.slice(0, clamped),
          { ...page, parentId, updatedAt: now },
          ...newSiblings.slice(clamped),
        ];
        ordered.forEach((p, index) => mockPages.set(p.id, { ...p, position: index }));

        const moved = mockPages.get(input.id) as Page;
        emitEvent('db:changed', { table: 'pages', action: 'reorder', id: input.id });
        return createMockResult(moved);
      },
      search: async (input: {
        query: string;
        limit?: number;
      }): Promise<IpcResult<PageSearchResult[]>> => {
        await new Promise((r) => setTimeout(r, 30));
        const query = input.query.trim().toLowerCase();
        if (!query) return createMockResult([]);
        const results = [...mockPages.values()]
          .map((page) => {
            const titleMatch = page.title.toLowerCase().includes(query);
            const contentMatch = (page.content ?? '').toLowerCase().includes(query);
            if (!titleMatch && !contentMatch) return null;
            return { page, rank: titleMatch ? 0 : 1 };
          })
          .filter((entry): entry is { page: Page; rank: number } => entry !== null)
          .sort(
            (a, b) => a.rank - b.rank || b.page.updatedAt.localeCompare(a.page.updatedAt),
          )
          .slice(0, input.limit ?? 20)
          .map(({ page, rank }) => ({
            page,
            rank,
            snippet: buildMockSnippet(page.content ?? page.title, query),
          }));
        return createMockResult(results);
      },
    },
  },
  ical: {
    fetch: async (_url: string): Promise<IpcResult<ICalEvent[]>> => {
      await new Promise((r) => setTimeout(r, 500));
      return createMockResult([]);
    },
    import: async (_input: {
      events: ICalEvent[];
      sourceUrl: string;
    }): Promise<IpcResult<{ imported: number; updated: number; skipped: number }>> => {
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
        nextRun: new Date(
          Date.now() + mockSettings.syncIntervalMinutes * 60 * 1000,
        ).toISOString() as IsoDateTime,
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
        nextRun: mockSettings.autoFetchIcal
          ? (new Date(
              Date.now() + mockSettings.syncIntervalMinutes * 60 * 1000,
            ).toISOString() as IsoDateTime)
          : null,
        lastError: null,
      });
    },
    trigger: async (_input?: { sourceId?: string }): Promise<IpcResult<void>> => {
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
  onIcalProgress: (
    callback: (payload: { stage: string; progress: number; message?: string }) => void,
  ) => {
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
