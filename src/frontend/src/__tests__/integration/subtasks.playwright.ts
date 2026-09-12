/**
 * Sub-tasks E2E — Playwright
 *
 * Covers adding, toggling (with progress update), and deleting sub-tasks
 * with confirmation, against the browser mock API.
 *
 * @module @frontend/__tests__/integration/subtasks
 */

import { test, expect, type Page } from '@playwright/test';

async function openAssignment(page: Page, id = '1'): Promise<void> {
  await page.goto(`/assignments/${id}`);
  await expect(page.locator('article.assignment-detail')).toBeVisible();
  await expect(page.locator('#subtasks-heading')).toBeVisible();
}

test.describe('Sub-tasks', () => {
  test.beforeEach(async ({ page }) => {
    await openAssignment(page);
  });

  test('adds a sub-task and shows it in the list', async ({ page }) => {
    const input = page.locator('#subtask-add-input');
    await input.fill('Write unit tests');
    await input.press('Enter');

    await expect(
      page.locator('.subtask-row__title', { hasText: 'Write unit tests' }),
    ).toBeVisible();
  });

  test('toggles a sub-task and updates the progress indicator', async ({ page }) => {
    // Start from the list so client-side back/forward navigation preserves state.
    await page.goto('/');
    await page.locator('[data-assignment-id="1"]').click();
    await expect(page.locator('article.assignment-detail')).toBeVisible();

    const checkbox = page.locator('.subtask-row').nth(1).locator('input[type="checkbox"]');
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Navigate away and back to force a fresh fetch, then confirm the header
    // progress indicator reflects the toggle (2 of 3 complete).
    await page.getByRole('button', { name: 'Back to assignments' }).click();
    await page.locator('[data-assignment-id="1"]').click();

    await expect(page.locator('.progress-bar').first()).toHaveAttribute('aria-valuenow', '67');
  });

  test('deletes a sub-task after confirming', async ({ page }) => {
    const firstRow = page.locator('.subtask-row').first();
    const title = ((await firstRow.locator('.subtask-row__title').textContent()) ?? '').trim();

    await firstRow.locator('button[aria-label^="Delete sub-task:"]').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('.subtask-row__title', { hasText: title })).toHaveCount(0);
  });
});
