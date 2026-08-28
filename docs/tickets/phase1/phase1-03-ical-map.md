# Ticket: phase1-03-ical-map

**Phase:** 1 — MVP (Tracking Assignments)  
**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 0.5 day

---

## Description

Add a `mapICalToAssignments(events: ICalEvent[], sourceUrl: string): AssignmentInput[]` function in `src/backend/main/ical/` that transforms parsed `ICalEvent[]` into `AssignmentInput[]` ready for database insertion via the repository.

**IMPORTANT**: The current `AssignmentInput` type in `src/backend/shared/types.ts` is minimal (8 fields). This ticket requires the **Data Model Alignment (ticket 1.0)** to be completed first, which extends `AssignmentInput` with all iCal mapping fields.

---

## Requirements

### Functional

- [ ] `mapICalToAssignments(events: ICalEvent[], sourceUrl: string)` returns `AssignmentInput[]`
- [ ] **Course extraction heuristic** (in priority order):
  1. First `CATEGORIES` entry that looks like a course code (regex: `/^[A-Z]{2,4}\d{3,4}/` — improve to handle more formats)
  2. Parse from `SUMMARY` prefix: `[COURSE] Title` or `COURSE: Title`
  3. Fallback: `"Unknown Course"`
- [ ] **Due date**: Use `dtStart` (Canvas uses `DTSTART` for due date) → convert ISO string to Unix ms
- [ ] **Source tracking**: `source = 'ical'`, `sourceUrl = event.url ?? sourceUrl`, `icalUid = event.uid`
- [ ] **Status**: Default `'pending'` (other values: `'in_progress'`, `'completed'`, `'archived'` per `AssignmentStatus`)
- [ ] **Priority**: Numeric — sooner due date = higher priority (lower number = higher priority)
  - Calculate: `Math.floor((dueDate - now) / (1000 * 60 * 60 * 24))` → days until due
  - Clamp: 0 (overdue) to 999 (far future)
  - **Note**: Overdue = 0 (highest priority). Consider if this is desired UX.
- [ ] **Title**: Use `event.summary` (trim whitespace)
- [ ] **Description**: Use `event.description` (may be HTML, can be null)
- [ ] **Course color**: Generate deterministic **hex** color from course name (e.g., `#RRGGBB`)
- [ ] Preserve `rrule` on Assignment for future expansion (Phase 2+)

### Non-Functional

- [ ] Pure function — no I/O, no side effects
- [ ] Zero `any` — `AssignmentInput` defined in `src/backend/shared/types.ts` (extended by ticket 1.0)
- [ ] Deterministic course color generation (same course = same color)
- [ ] Unit tests with varied `ICalEvent` inputs

---

## Designs & Constraints

- **Location**: `src/backend/main/ical/map.ts`
- **Export**: `mapICalToAssignments`, `extractCourseName`, `generateCourseColor` (testable helpers)
- **Dependencies**: None (pure TS)
- **Prerequisite**: Ticket 1.0 (Data Model Alignment) must extend `AssignmentInput` and `Assignment` types

### `AssignmentInput` Type (after ticket 1.0 alignment)

```typescript
export interface AssignmentInput {
  title: string;
  description: string;
  courseId: EntityId | null; // Course ID (not name) — link to Course table in future
  dueDate: IsoDateTime | null; // ISO 8601 UTC string
  priority: number;
  status: AssignmentStatus; // 'pending' | 'in_progress' | 'completed' | 'archived'
  source: AssignmentSource; // 'manual' | 'ical'
  sourceUrl: string | null; // iCal UID or URL if imported
}
```

**Note**: The current type is minimal. Ticket 1.0 will extend it with: `courseName`, `courseColor`, `unlockAt`, `lockAt`, `pointsPossible`, `submissionTypes`, `workflowState`, `htmlUrl`, `icalUid`, `rrule` — matching the database schema.

### Course Color Generation (returns hex)

```typescript
function generateCourseColor(courseName: string): string {
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  // Convert HSL to hex
  const hslToHex = (h: number, s: number, l: number) => {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0,
      g = 0,
      b = 0;
    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };
  return hslToHex(hue, 65, 45);
}
```

---

## Code Changes

### New Files

- `src/backend/main/ical/map.ts` — mapper implementation
- `src/backend/main/ical/__tests__/map.test.ts` — unit tests

### Prerequisites

- Ticket 1.0 (Data Model Alignment) completes first

### Modified Files

- `src/backend/shared/types.ts` — ensure `AssignmentInput` has all required fields (add `rrule`, `icalUid`, `source`, `sourceUrl`, `priority`, `status`)

---

## Acceptance Criteria

| #   | Criterion                                                 | Verification                                                      |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Maps `ICalEvent[]` → `AssignmentInput[]` correctly        | Unit test with fixture events                                     |
| 2   | Extracts course from `CATEGORIES` (priority 1)            | Test: `categories: ['CS101', 'Fall2025']` → `courseName: 'CS101'` |
| 3   | Falls back to `SUMMARY` prefix parsing (priority 2)       | Test: `summary: '[CS101] Homework 1'` → `courseName: 'CS101'`     |
| 4   | Falls back to "Unknown Course" (priority 3)               | Test: no categories, no prefix → `courseName: 'Unknown Course'`   |
| 5   | Priority calculated from due date (sooner = lower number) | Test: due tomorrow → priority 1; due in 10 days → priority 10     |
| 6   | Deterministic course color                                | Same course name → same color                                     |
| 7   | Preserves `rrule` on output                               | Test with recurring event                                         |
| 8   | All tests pass (`pnpm test`)                              | CI run                                                            |

---

## Notes

- Course extraction heuristic should be documented in `docs/architecture/data-model.md`
- This mapper is called by `ical:import` IPC handler (ticket 1.5)
- `AssignmentInput` fields must match the `assignments` table schema from Phase 0 (ticket 0.3)

---

## Release Summary

Add iCal-to-Assignment mapper with course extraction heuristic and priority calculation
