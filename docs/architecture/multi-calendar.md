# Multi-Calendar Support (Multi-Feed) — Design Notes

> **Status:** Planned · Target phase: Phase 4
> Related: `docs/roadmap.md` (Phase 4), `docs/architecture/data-model.md`,
> `docs/architecture/ipc-contract.md`, `docs/architecture/security.md`

## 1. Goal

Today CourseFlow syncs exactly **one** iCal feed, stored as `settings.icalUrl`
(encrypted at rest). Users with several calendars (Google primary, Google
Contacts "Birthdays", Canvas, Outlook, a shared family calendar…) can only see
one at a time — and, as discovered during MVP debugging, events that live on a
secondary Google calendar (e.g. the auto-generated **Birthdays** calendar) are
invisible because they never appear in the configured feed.

The goal of this phase:

- Allow **N iCal feeds** (“calendar sources”).
- Each source is a named, enabled, individually-syncable feed.
- The assignment list is a **unified view** across all sources, with
  attribution (which calendar an item came from) surfaced via filter + badge.
- Per-source failures must not take down other calendars.

## 2. Domain model

### New entity: `CalendarSource`

| Field                                        | Type    | Notes                                         |
| -------------------------------------------- | ------- | --------------------------------------------- |
| `id`                                         | UUID PK |                                               |
| `name`                                       | TEXT    | User label, e.g. “School”, “Birthdays”        |
| `feed_url`                                   | TEXT    | Encrypted (reuse AES-GCM path from `icalUrl`) |
| `enabled`                                    | INTEGER | 0/1 — disabled sources are not fetched        |
| `color`                                      | TEXT    | Optional accent color for badges / grouping   |
| `position`                                   | INTEGER | Display order (0 = top)                       |
| `last_sync_at`, `next_sync_at`, `last_error` |         | Per-source sync state, surfaced in the UI     |
| `created_at`, `updated_at`                   | INTEGER | Timestamps (ms)                               |

### Assignment linkage

`assignments` already stores:

- `source` — `'manual' | 'ical'`
- `source_url` — the feed URL the assignment came from
- `ical_uid` — dedupe key (per occurrence for expanded recurring events)
- `rrule` — preserved for reference

For multi-feed we add:

- `assignments.source_id` (TEXT, nullable FK → `calendars.id`) — stable
  attribution that survives feed-URL changes.
- Unique dedupe key becomes `(source_id, ical_uid)` instead of global
  `ical_uid` (today two different calendars could legitimately emit the same
  UID).

Backwards-compatible migration path: seed one `calendars` row from the existing
`settings.icalUrl` (name “Calendar 1” or auto-derived) and backfill
`source_id` by matching `source_url`.

## 3. Sync pipeline changes

### Current behaviour (single feed)

```
fetch(url) → parse → mapICalToAssignments (window: past 30d / next 60d, RRULE expansion)
           → repo.importAssignments(assignments)
                ├ upsert by ical_uid
                └ prune: DELETE source='ical' rows whose ical_uid is NOT in batch
                        (preserving status completed/archived and source='manual')
```

### ⚠️ Blocking refactor before multiple feeds

The prune inside `repo.importAssignments` is currently **global**: it deletes
any `ical` row not present in the current import batch. With one feed that
keeps the DB as a mirror of feed ∩ window. With several feeds, importing feed A
must **not** delete feed B's rows. Required change:

- `importAssignments(inputs, { sourceId })` (or per-source equivalent) prunes
  only rows where `source_id = sourceId` (fall back to `source_url` for
  existing rows until `source_id` is backfilled).
- Every assignment emitted by the mapper carries its source id.

### Per-source fetch loop

```
for each enabled CalendarSource (in position order):
    lastError = null
    try:
        icalText   = fetchICalFeed(source.feedUrl)      // timeout/retry as today
        events     = parseICalFeed(icalText)
        assignments= mapICalToAssignments(events, source)
        repo.importAssignments(assignments, { sourceId: source.id, sourceUrl })
        update source.last_sync_at
        emit per-source progress (ical:progress with sourceId in payload)
    catch:
        classify error; retry w/ backoff per source (max 3)
        update source.last_error; keep other sources unaffected
```

The existing `Scheduler` becomes a coordinator that runs one cycle per source.
Manual “Sync Now” syncs all enabled sources; an optional per-source “Sync” in
Settings syncs one.

## 4. Window / expansion semantics (unchanged)

The single-feed mapper rules carry over unchanged per source:

- Keep only events whose start is in **[now − 30d, now + 60d]**.
- Expand RRULE masters into per-occurrence rows with
  `ical_uid = <uid>@<occurrenceStart>`.
- Treat all-day (VALUE=DATE) events as **12:00 UTC** so they render on the
  right calendar date locally (see parse.ts).

## 5. UI changes (sketch)

- **Settings → Calendars**: list of sources with name/color/enabled, add,
  remove, edit; “Fetch Now” per source and “Sync all”.
- **TopBar sync indicator**: last-sync / next-sync summary + per-source status
  (success/error/never) via a small popover.
- **Unified list**: existing filter bar gains a “Calendar” (source) filter next
  to the Course filter; rows/badges may show source color; grouping “By
  Calendar” optional.
- **Empty / error states**: distinguish “no feeds configured” from “no events in
  window”.
- Course colors already derive from course name; with multiple schools it may
  make sense to namespace colors per source to avoid collisions.

## 6. IPC / shared-types delta (sketch)

Add channels (mirroring existing style):

- `calendars:list` / `calendars:create` / `calendars:update` /
  `calendars:delete`
- `calendars:sync` (single) and extend `ical:import`/`scheduler:*` payloads with
  `sourceId`.
- `scheduler:tick` / `ical:progress` payloads gain `sourceId`.
- `FilterState` gains `sourceFilter: string[]`.
- `Settings` no longer owns `icalUrl`/`lastSyncAt`; those move to
  `CalendarSource`. Keep reading legacy fields for one migration cycle.

## 7. Security & storage

- Each `feed_url` is encrypted exactly like today's `icalUrl`
  (`docs/architecture/security.md`), per row.
- Plaintext URLs stay in the main process only.
- Error messages must never leak decrypted URLs (already the case via
  `sanitizeUrlForLogging` in fetch.ts).

## 8. Open questions

- Duplicate real-world events across calendars (same class in two feeds) —
  dedupe policy (by title+window? user merges? show both with sources?).
- Per-source window vs global window — treat each feed with its own window and
  union results (recommended) vs. one global window.
- Multi-feed priority ordering interplay (single `priority_order` over the
  union remains fine — ids are globally unique).
- Backfill & migration ordering for existing single-feed installs.
- Whether the Birthdays-style Google calendars expose a stable secret iCal URL
  per calendar (they do via each calendar's “Integrate calendar” settings).

## 9. Suggested ticket breakdown (future)

1. Schema + migration: `calendars` table, `assignments.source_id`, seed row.
2. Repository refactor: scope upsert/dedupe/prune per source; backfill.
3. Scheduler: per-source fetch loop + per-source retry/status.
4. IPC + preload: `calendars.*` channels, `sourceId` on progress/sync events.
5. Settings UI: manage calendars (add/remove/enable/name/color/order).
6. Unified list: source filter + attribution + colors.
7. Sync-status UI: per-source status popover.
8. Tests: per-source prune isolation, multi-feed import, duplicate UID across
   feeds.
