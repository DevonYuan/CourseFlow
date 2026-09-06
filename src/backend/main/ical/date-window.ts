/**
 * Import Date Window — Main Process
 *
 * Single source of truth for the event/assignment time window used when
 * importing iCal data:
 * - PAST_WINDOW_DAYS  = 30  (recent history shown in the list)
 * - FUTURE_WINDOW_DAYS = 60 (upcoming events shown in the list)
 *
 * Both `map.ts` (mapper filters/expands events into this window) and
 * `db/repository.ts` (importAssignments prunes rows that fall outside this
 * window) read from here so the numbers can never drift apart.
 *
 * @module @backend/main/ical/date-window
 */

/** Number of days in the past to keep (recent history). */
export const PAST_WINDOW_DAYS = 30;

/** Number of days in the future to keep (upcoming events). */
export const FUTURE_WINDOW_DAYS = 60;

/** Milliseconds in one day (assumes UTC days for window math). */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A date window expressed as both Date objects and epoch milliseconds.
 */
export interface DateWindow {
  /** Inclusive window start as a Date. */
  start: Date;
  /** Inclusive window end as a Date. */
  end: Date;
  /** Inclusive window start in epoch milliseconds. */
  startMs: number;
  /** Inclusive window end in epoch milliseconds. */
  endMs: number;
}

/**
 * Computes the import window relative to a reference time.
 *
 * @param now - Reference time in milliseconds (defaults to Date.now())
 * @returns Window covering [now - 30 days, now + 60 days]
 */
export function getDateWindow(now: number = Date.now()): DateWindow {
  const startMs = now - PAST_WINDOW_DAYS * DAY_MS;
  const endMs = now + FUTURE_WINDOW_DAYS * DAY_MS;
  return {
    start: new Date(startMs),
    end: new Date(endMs),
    startMs,
    endMs,
  };
}
