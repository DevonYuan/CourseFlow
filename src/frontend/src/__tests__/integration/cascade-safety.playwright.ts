/**
 * Cascade Safety E2E — Playwright
 *
 * Regression protection for the critical data-loss scenarios:
 * deleting an assignment cascades to its sub-tasks and notes, and deleting
 * one assignment never touches another assignment's productivity data.
 *
 * These assertions run against the browser mock API (which mirrors the main
 * process IPC contract), exercising the same cascade semantics.
 *
 * @module @frontend/__tests__/integration/cascade-safety
 */

import { test, expect } from '@playwright/test';

test.describe('Cascade safety', () => {
  test('deleting an assignment cascades to its sub-tasks and notes', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const subsBefore = await window.api.db.subtasks.list('1');
      const notesBefore = await window.api.db.notes.list('1');

      await window.api.db.assignments.delete('1');

      const subsAfter = await window.api.db.subtasks.list('1');
      const notesAfter = await window.api.db.notes.list('1');

      return {
        subsBefore: subsBefore.ok ? subsBefore.data.length : -1,
        notesBefore: notesBefore.ok ? notesBefore.data.length : -1,
        subsAfter: subsAfter.ok ? subsAfter.data.length : -1,
        notesAfter: notesAfter.ok ? notesAfter.data.length : -1,
      };
    });

    expect(result.subsBefore).toBeGreaterThan(0);
    expect(result.notesBefore).toBeGreaterThan(0);
    expect(result.subsAfter).toBe(0);
    expect(result.notesAfter).toBe(0);
  });

  test('deleting one assignment does not affect another assignment data', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const before = await window.api.db.subtasks.list('2');

      await window.api.db.assignments.delete('1');

      const after = await window.api.db.subtasks.list('2');

      return {
        before: before.ok ? before.data.length : -1,
        after: after.ok ? after.data.length : -1,
      };
    });

    expect(result.before).toBeGreaterThan(0);
    expect(result.after).toBe(result.before);
  });

  test('sub-tasks and notes survive a re-import of their assignment', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const subsBefore = await window.api.db.subtasks.list('2');
      const notesBefore = await window.api.db.notes.list('2');

      // Simulate an iCal sync re-importing the same feed. The mock (like the
      // main process) must never touch user-created sub-tasks/notes.
      await window.api.ical.import({
        events: [],
        sourceUrl: 'https://canvas.example.com/feeds/calendars/user_abc123.ics',
      });

      const subsAfter = await window.api.db.subtasks.list('2');
      const notesAfter = await window.api.db.notes.list('2');

      return {
        subsBefore: subsBefore.ok ? subsBefore.data.length : -1,
        notesBefore: notesBefore.ok ? notesBefore.data.length : -1,
        subsAfter: subsAfter.ok ? subsAfter.data.length : -1,
        notesAfter: notesAfter.ok ? notesAfter.data.length : -1,
      };
    });

    expect(result.subsAfter).toBe(result.subsBefore);
    expect(result.notesAfter).toBe(result.notesBefore);
  });
});
