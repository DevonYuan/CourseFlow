/**
 * Timestamp Formatting Utilities
 *
 * Utilities for formatting note timestamps with relative time,
 * absolute timestamps on hover, and edited detection.
 *
 * @module @frontend/utils/timestamp
 */

import { formatDistanceToNow, format, isToday, isYesterday, subSeconds } from 'date-fns';

/**
 * Threshold in seconds to consider a note as "edited" after creation.
 * If updated_at is more than this many seconds after created_at, show "Edited" badge.
 */
const EDITED_THRESHOLD_SECONDS = 5;

/**
 * Formats a date as a relative time string.
 * Examples: "Just now", "2 minutes ago", "3 hours ago", "Yesterday at 3:30 PM", "Jan 15 at 10:00 AM"
 *
 * @param date - The date to format (string or Date)
 * @returns Formatted relative time string
 */
export function formatRelative(date: string | Date): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  const now = new Date();

  // Less than 1 minute = "Just now"
  const diffMs = now.getTime() - dateObj.getTime();
  if (diffMs < 60_000) {
    return 'Just now';
  }

  // Use date-fns formatDistanceToNow for more recent dates
  const distance = formatDistanceToNow(dateObj, { addSuffix: true, locale: undefined });

  // For dates within a week, return just the distance with relative suffix
  // For older dates, use "at" format with exact time
  if (isToday(dateObj) || isYesterday(dateObj)) {
    return distance;
  }

  // Check if within 7 days
  const weekAgo = subSeconds(now, 7 * 24 * 60 * 60);
  if (dateObj > weekAgo) {
    const timeStr = dateObj.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return distance.replace(' ago', ` at ${timeStr}`);
  }

  // Older than a week - show date and time
  const dateStr = format(dateObj, 'MMM d, yyyy');
  const timeStr = dateObj.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} at ${timeStr}`;
}

/**
 * Formats a date as an absolute ISO timestamp for tooltips.
 *
 * @param date - The date to format (string or Date)
 * @returns Formatted ISO timestamp (e.g., "2026-01-15T22:30:00.000Z")
 */
export function formatAbsolute(date: string | Date): string {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toISOString();
}

/**
 * Checks if a note was edited after creation.
 * Returns true if updated_at is more than EDITED_THRESHOLD_SECONDS after created_at.
 *
 * @param createdAt - Creation timestamp (ISO string or Date)
 * @param updatedAt - Update timestamp (ISO string or Date)
 * @returns true if the note was edited
 */
export function isEdited(createdAt: string | Date, updatedAt: string | Date): boolean {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const updated = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  const diffMs = updated.getTime() - created.getTime();
  return diffMs > EDITED_THRESHOLD_SECONDS * 1000;
}

/**
 * Gets the next edit threshold timestamp for display purposes.
 * Useful for accessibility announcements.
 */
export function isWithinEditThreshold(createdAt: string | Date, updatedAt: string | Date): boolean {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const updated = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  const diffMs = updated.getTime() - created.getTime();
  const thresholdMs = EDITED_THRESHOLD_SECONDS * 1000;
  return diffMs > thresholdMs;
}
