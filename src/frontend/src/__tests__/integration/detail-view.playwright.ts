/**
 * Assignment Detail View E2E — Playwright
 *
 * Covers list → detail navigation, back navigation, deep links,
 * the not-found state, and manually created assignments.
 *
 * @module @frontend/__tests__/integration/detail-view
 */

import type { EntityId } from '@backend/shared/types';
import { test, expect } from '@playwright/test';

test.describe('Assignment detail view', () => {
  test('navigates from the list to the detail view', async ({ page }) => {
    await page.goto('/');
    const firstRow = page.locator('[data-assignment-id]').first();
    const id = await firstRow.getAttribute('data-assignment-id');

    await firstRow.click();

    await expect(page).toHaveURL(new RegExp(`/assignments/${id}$`));
    await expect(page.locator('article.assignment-detail')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('back button returns to the list', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-assignment-id]').first().click();
    await expect(page.locator('article.assignment-detail')).toBeVisible();

    await page.getByRole('button', { name: 'Back to assignments' }).click();

    await expect(page.locator('[aria-label="Assignments"]').first()).toBeVisible();
  });

  test('deep link renders the requested assignment', async ({ page }) => {
    await page.goto('/assignments/2');

    await expect(page.getByRole('heading', { level: 1, name: /Problem Set 3/ })).toBeVisible();
  });

  test('unknown assignment id shows the not-found state', async ({ page }) => {
    await page.goto('/assignments/does-not-exist');

    await expect(page.getByText('Assignment not found')).toBeVisible();
  });

  test('renders a manually created assignment', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(async () => {
      await window.api.db.assignments.upsert({
        id: 'manual-e2e' as EntityId,
        title: 'Manual Assignment',
        courseName: 'Personal',
        source: 'manual',
        status: 'pending',
      });
    });

    // The list refetches on db:changed; navigate client-side because the browser
    // mock keeps its data in memory only (a full reload would reset it).
    const row = page.locator('[data-assignment-id="manual-e2e"]');
    await expect(row).toBeVisible();
    await row.click();

    await expect(page.getByRole('heading', { level: 1, name: 'Manual Assignment' })).toBeVisible();
  });
});
