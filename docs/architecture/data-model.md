# Data Model

This document defines the core data entities and their fields for CourseFlow. All entities are stored locally in SQLite.

## Entities

### Assignment

Represents a Canvas assignment synced via iCal, with user-extensible fields.

| Field              | Type      | Required | Description                                                            |
| ------------------ | --------- | -------- | ---------------------------------------------------------------------- |
| `id`               | `TEXT`    | Yes      | Primary key (UUID)                                                     |
| `canvas_id`        | `TEXT`    | No       | Canvas assignment ID (numeric, stored as text)                         |
| `title`            | `TEXT`    | Yes      | Assignment title                                                       |
| `description`      | `TEXT`    | No       | Full description (HTML from Canvas)                                    |
| `course_name`      | `TEXT`    | Yes      | Course name from Canvas                                                |
| `course_color`     | `TEXT`    | No       | Course color hex (e.g., `#e83e8c`)                                     |
| `due_at`           | `TEXT`    | No       | ISO 8601 datetime (UTC)                                                |
| `unlock_at`        | `TEXT`    | No       | ISO 8601 datetime (UTC)                                                |
| `lock_at`          | `TEXT`    | No       | ISO 8601 datetime (UTC)                                                |
| `points_possible`  | `INTEGER` | No       | Maximum points                                                         |
| `submission_types` | `TEXT`    | No       | JSON array of strings (e.g., `["online_text_entry", "online_upload"]`) |
| `workflow_state`   | `TEXT`    | No       | Canvas workflow state (e.g., `published`, `unpublished`)               |
| `html_url`         | `TEXT`    | No       | Direct link to assignment in Canvas                                    |
| `ical_uid`         | `TEXT`    | No       | iCal UID for deduplication across syncs                                |
| `created_at`       | `TEXT`    | Yes      | ISO 8601 datetime when record created (UTC)                            |
| `updated_at`       | `TEXT`    | Yes      | ISO 8601 datetime when record last updated (UTC)                       |

**Source:** iCal feed + Canvas API + user extensions

---

### PriorityOrder

User-defined priority ordering for assignments (drag-and-drop position).

| Field           | Type      | Required | Description                                     |
| --------------- | --------- | -------- | ----------------------------------------------- |
| `assignment_id` | `TEXT`    | Yes      | FK → `Assignment.id` (also primary key)         |
| `position`      | `INTEGER` | Yes      | Zero-based sort order (lower = higher priority) |

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
| `created_at`    | `TEXT`    | Yes      | ISO 8601 datetime (UTC)         |
| `updated_at`    | `TEXT`    | Yes      | ISO 8601 datetime (UTC)         |

**Source:** User

---

### Note

Free-form notes attached to an assignment (one note per assignment).

| Field           | Type   | Required | Description                                   |
| --------------- | ------ | -------- | --------------------------------------------- |
| `assignment_id` | `TEXT` | Yes      | FK → `Assignment.id` (also primary key)       |
| `content`       | `TEXT` | Yes      | Note content (Markdown or plain text)         |
| `updated_at`    | `TEXT` | Yes      | ISO 8601 datetime when note last edited (UTC) |

**Source:** User

---

### Settings

Key-value store for application settings (JSON values).

| Field   | Type   | Required | Description                                             |
| ------- | ------ | -------- | ------------------------------------------------------- |
| `key`   | `TEXT` | Yes      | Primary key (e.g., `ical_url`, `sync_interval_minutes`) |
| `value` | `TEXT` | Yes      | JSON-encoded value                                      |

**Source:** User + app

**Known keys:**

- `ical_url`: Encrypted iCal URL (see `security.md` for encryption format)
- `sync_interval_minutes`: Auto-sync interval in minutes (default: `15`, user-configurable)
- `theme`: UI theme preference (`"light"`, `"dark"`, `"system"`)

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

| Table           | Index                      | Columns         |
| --------------- | -------------------------- | --------------- |
| `Assignment`    | `idx_assignment_canvas_id` | `canvas_id`     |
| `Assignment`    | `idx_assignment_due_at`    | `due_at`        |
| `Assignment`    | `idx_assignment_course`    | `course_name`   |
| `SubTask`       | `idx_subtask_assignment`   | `assignment_id` |
| `PriorityOrder` | (PK)                       | `assignment_id` |
| `Note`          | (PK)                       | `assignment_id` |
