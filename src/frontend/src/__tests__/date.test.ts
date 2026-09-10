/**
 * formatRelativeTime Utility Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatRelativeTime } from '../utils/date';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for a timestamp under a minute ago', () => {
    expect(formatRelativeTime('2026-09-05T11:59:30.000Z')).toBe('Just now');
  });

  it('returns minutes ago', () => {
    expect(formatRelativeTime('2026-09-05T11:55:00.000Z')).toBe('5m ago');
  });

  it('returns hours ago', () => {
    expect(formatRelativeTime('2026-09-05T10:00:00.000Z')).toBe('2h ago');
  });

  it('returns days ago', () => {
    expect(formatRelativeTime('2026-09-02T12:00:00.000Z')).toBe('3d ago');
  });

  it('falls back to an absolute date after a week', () => {
    const result = formatRelativeTime('2026-08-01T12:00:00.000Z');
    expect(result).not.toMatch(/ago/);
    expect(result).toMatch(/Aug/);
  });
});
