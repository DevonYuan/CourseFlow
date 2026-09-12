/**
 * Date Formatting Utilities
 *
 * Shared date formatting functions for consistent date display across the app.
 * Handles overdue, today, tomorrow, all-day events, and relative labels.
 *
 * @module @frontend/utils/date
 */

import { format, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';

/**
 * Checks if a due date is an all-day event.
 * All-day events from iCal have VALUE=DATE and are stored with time 00:00 UTC.
 * We detect them by checking if the time component is 00:00:00.000Z.
 */
export function isAllDayEvent(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const date = new Date(dueAt);
  // Check if time is exactly midnight UTC (indicating all-day event from iCal)
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

/**
 * Formats a due date for display in the assignment list/row.
 * Returns format like "Mon, Jan 15 • 11:59 PM" or "Mon, Jan 15 • All day".
 */
export function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return 'No due date';

  const date = new Date(dueAt);

  if (isAllDayEvent(dueAt)) {
    const day = date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `${day} • All day`;
  }

  const day = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} • ${time}`;
}

/**
 * Formats a due date for the detail view header.
 * Returns more detailed format with relative labels: "Today at 11:59 PM", "Tomorrow at 9:00 AM", "Overdue: Mon, Jan 15 at 11:59 PM".
 */
export function formatDueDateDetail(dueAt: string | null): {
  label: string;
  isOverdue: boolean;
  isAllDay: boolean;
} {
  if (!dueAt) {
    return { label: 'No due date', isOverdue: false, isAllDay: false };
  }

  const date = new Date(dueAt);
  const now = new Date();
  const isAllDay = isAllDayEvent(dueAt);
  const isOverdue = !isAllDay && date < now;

  // For all-day events, compare by calendar day only
  let isPastCalendarDay = false;
  if (isAllDay) {
    isPastCalendarDay = differenceInCalendarDays(now, date) > 0;
  }

  let label: string;

  if (isAllDay) {
    if (isToday(date)) {
      label = 'Due today (all day)';
    } else if (isTomorrow(date)) {
      label = 'Due tomorrow (all day)';
    } else if (isPastCalendarDay) {
      label = `Overdue: ${format(date, 'EEEE, MMMM d')}`;
    } else {
      label = `Due ${format(date, 'EEEE, MMMM d')}`;
    }
  } else {
    const timeStr = format(date, 'h:mm a');
    if (isToday(date)) {
      label = isOverdue ? `Overdue: Today at ${timeStr}` : `Today at ${timeStr}`;
    } else if (isTomorrow(date)) {
      label = `Tomorrow at ${timeStr}`;
    } else if (isOverdue) {
      label = `Overdue: ${format(date, 'EEEE, MMMM d')} at ${timeStr}`;
    } else {
      label = `${format(date, 'EEEE, MMMM d')} at ${timeStr}`;
    }
  }

  return { label, isOverdue: isOverdue || isPastCalendarDay, isAllDay };
}

/**
 * Formats a date for display (created/updated timestamps).
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns a relative time string (e.g., "2 hours ago", "3 days ago").
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDateTime(dateString);
}
