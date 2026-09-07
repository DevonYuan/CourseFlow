# Data Model

This document defines the core data entities and their fields for CourseFlow. All entities are stored locally in SQLite.

## Entities

### Assignment

Represents an item synced from an **iCal feed** (Google Calendar, Canvas, Outlook, etc.), with user-extensible fields.

| Field              | Type      | Required | Description                                                                      |
| ------------------ | --------- | -------- | -------------------------------------------------------------------------------- |
| `id`               | `TEXT`    | Yes      | Primary key (UUID)                                                               |
| `canvas_id`        | `TEXT`    | No       | Legacy Canvas-style ID (unused by the iCal importer; nullable)                   |
| `title`            | `TEXT`    | Yes      | Assignment/event title (from `SUMMARY`)                                          |
| `description`      | `TEXT`    | No       | Full description from the feed (may contain HTML/newlines)                       |
| `course_name`      | `TEXT`    | Yes      | Course name derived from the feed (CATEGORIES/SUMMARY heuristic or "Unknown Course") |
| `course_color`     | `TEXT`    | No       | Deterministic hex color derived from `course_name`                                |
| `due_at`           | `INTEGER` | Yes      | Due/start time — Unix epoch **milliseconds** (UTC)                                |
| `unlock_at`        | `INTEGER` | No       | Unix epoch milliseconds (UTC)                                                    |
| `lock_at`          | `INTEGER` | No       | Unix epoch milliseconds (UTC)                                                    |
| `points_possible`  | `REAL`    | No       | Maximum points (nullable)                                                        |
| `submission_types` | `TEXT`    | No       | JSON array of strings (unused by the iCal importer; default `[]`)                |
| `workflow_state`   | `TEXT`    | No       | Feed state (default `published`)                                                 |
| `html_url`         | `TEXT`    | No       | Event URL when the feed provides one (e.g., `URL:` property)                     |
| `ical_uid`         | `TEXT`    | No       | iCal UID — dedupe key across syncs (unique; per-occurrence for recurring events) |
| `status`           | `TEXT`    | No       | User state: `pending` \| `in_progress` \| `completed` \| `archived` (default `pending`) |
| `source`           | `TEXT`    | No       | `ical` or `manual` (default `manual`)                                            |
| `source_url`       | `TEXT`    | No       | Feed URL this assignment was imported from                                        |
| `rrule`            | `TEXT`    | No       | Recurrence rule string, preserved for reference                                   |
| `created_at`       | `INTEGER` | Yes      | Unix epoch milliseconds when created (UTC)                                        |
| `updated_at`       | `INTEGER` | Yes      | Unix epoch milliseconds when last updated (UTC)                                   |

**Source:** iCal feed (single feed in the MVP) + user actions

> **Note:** All `*_at` columns are stored as **Unix epoch milliseconds** (SQLite `INTEGER`), not ISO strings. The repository mappers (`toIsoDateTime` / `toUnixMs`) convert to ISO 8601 UTC strings at the TypeScript boundary.

---

### PriorityOrder

User-defined priority ordering for assignments (drag-and-drop position).

| Field           | Type      | Required | Description                                             |
| --------------- | --------- | -------- | ------------------------------------------------------- |
| `assignment_id` | `TEXT`    | Yes      | FK → `Assignment.id` (also primary key)                 |
| `position`      | `INTEGER` | Yes      | Zero-based sort order (lower = higher priority, UNIQUE) |
| `created_at`    | `INTEGER` | No       | Unix epoch milliseconds (added by migration v3)         |
| `updated_at`    | `INTEGER` | No       | Unix epoch milliseconds (added by migration v3)         |

**Source:** User drag-drop

---

### SubTask

User-created sub-tasks for an assignment.

| Field           | Type      | Required | Description                     |
| --------------- | --------- | -------- | ------------------------------- |
| `id`            | `TEXT`    | Yes      | Primary key (UUID)              |
| `assignment_id` | `TEXT`    | Yes      | FK → `Assignment.id`            |
| `title`         | `TEXT`    | Yes      | Sub-task title                  |
| `completed`     | `INTEGER` | Yes      | Boolean (0/1)                   |
| `position`      | `INTEGER` | Yes      | Display order within assignment |
| `created_at`    | `INTEGER` | Yes      | Unix epoch milliseconds (UTC)   |
| `updated_at`    | `INTEGER` | Yes      | Unix epoch milliseconds (UTC)   |

**Source:** User

---

### Note

Free-form notes attached to an assignment (one note per assignment).

| Field           | Type   | Required | Description                                   |
| --------------- | ------ | -------- | --------------------------------------------- |
| `assignment_id` | `TEXT` | Yes      | FK → `Assignment.id` (also primary key)       |
| `content`       | `TEXT` | Yes      | Note content (plain text / Markdown-ready)    |
| `updated_at`    | `INTEGER` | Yes   | Unix epoch milliseconds when last edited (UTC) |

**Source:** User

---

### Settings

Key-value store for application settings (JSON values).

| Field   | Type   | Required | Description                                             |
| ------- | ------ | -------- | ------------------------------------------------------- |
| `key`   | `TEXT` | Yes      | Primary key (e.g., `ical_url`, `sync_interval_minutes`) |
| `value` | `TEXT` | Yes      | JSON-encoded value                                      |

**Source:** User + app

**Known keys (camelCase JSON values in `settings.value`):**

- `theme`: `"light"` | `"dark"` | `"system"`
- `autoFetchIcal`: boolean — enables the background scheduler
- `icalFetchIntervalMinutes`: interval shown by the Settings "Auto-fetch Interval" dropdown
- `syncIntervalMinutes`: scheduler interval in minutes (default `15`; `0` disables auto-fetch)
- `defaultPriority`: `"low" | "medium" | "high"` (reserved — no manual-add UI yet)
- `showCompletedAssignments`: boolean (TopBar "Show Completed" toggle)
- `notifyDueSoon`: boolean (reserved for Phase 5 notifications)
- `dueSoonThresholdHours`: number (reserved for Phase 5 notifications)
- `icalUrl`: **encrypted** iCal feed URL — JSON envelope `{ v: 1, ciphertext, iv, salt }`, see `security.md`
- `lastSyncAt`: ISO 8601 string (UTC) of the last successful import
- `autoFetchIntervalMs`: **computed** field (`icalFetchIntervalMinutes * 60 000`) — never persisted

> **Note:** The `settings` table is key-value (`key`, `value`) with JSON in `value`. Migration v2 also added legacy columns `ical_url` / `last_sync_at` to the table, but new code reads and writes through the key-value rows above.

---

## Relationships

```
Assignment 1 ─── 0..1 PriorityOrder
Assignment 1 ─── 0..N SubTask
Assignment 1 ─── 0..1 Note
```

- `PriorityOrder`, `Note` use `assignment_id` as primary key (one-to-one)
- `SubTask` uses its own `id` as PK, with `assignment_id` as FK (one-to-many)

---

## Indexes

| Table           | Index                                         | Columns                     |
| --------------- | --------------------------------------------- | --------------------------- |
| `assignments`   | UNIQUE constraint on `canvas_id`              | `canvas_id`                 |
| `assignments`   | UNIQUE index `idx_assignments_ical_uid`       | `ical_uid`                  |
| `assignments`   | `idx_assignments_due_at`                      | `due_at`                    |
| `assignments`   | `idx_assignments_course`                      | `course_name`               |
| `sub_tasks`     | `idx_sub_tasks_assignment`                    | `assignment_id`, `position` |
| `priority_order`| UNIQUE constraint + `idx_priority_order_position` | `position`              |
| `notes`         | PK                                            | `assignment_id`             |
| `settings`      | PK                                            | `key`                       |
