/**
 * Notes E2E — Playwright
 *
 * Covers rendering notes with timestamps, adding, editing, and deleting
 * a note, against the browser mock API.
 *
 * @module @frontend/__tests__/integration/notes
 */

import { test, expect, type Page } from '@playwright/test';

async function openAssignment(page: Page, id = '1'): Promise<void> {
  await page.goto(`/assignments/${id}`);
  await expect(page.locator('article.assignment-detail')).toBeVisible();
  await expect(page.locator('#notes-heading')).toBeVisible();
}

test.describe('Notes', () => {
  test.beforeEach(async ({ page }) => {
    await openAssignment(page);
  });

  test('shows existing notes with timestamps', async ({ page }) => {
    await expect(page.locator('[data-testid="note-content"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="note-updated-timestamp"]').first()).toBeVisible();
  });

  test('adds a note', async ({ page }) => {
    await page.getByRole('button', { name: 'Add a new note' }).click();

    const editor = page.locator('.notes-editor textarea');
    await expect(editor).toBeVisible();
    await editor.fill('Finished the first draft');
    await expect(editor).toHaveValue('Finished the first draft');

    await page.getByRole('button', { name: /^Save/ }).click();

    await expect(
      page.locator('[data-testid="note-content"]', { hasText: 'Finished the first draft' }),
    ).toBeVisible();
  });

  test('edits a note', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit note' }).first().click();

    const editor = page.locator('textarea[aria-label="Note content"]');
    await expect(editor).toBeVisible();

    await editor.fill('Updated note content');
    await page.getByRole('button', { name: /^Save/ }).click();

    // Saving closes the editor and returns to the note list
    await expect(editor).not.toBeVisible();
  });

  test('deletes a note after confirming', async ({ page }) => {
    const firstNote = page.locator('[data-testid="note-content"]').first();
    const firstContent = (await firstNote.textContent()) ?? '';

    await page.getByRole('button', { name: 'Delete note' }).first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(
      page.locator('[data-testid="note-content"]', { hasText: firstContent }),
    ).toHaveCount(0);
  });
});
