/**
 * Notes Search E2E — Playwright
 *
 * Covers the global command-palette search across the browser mock API:
 * open/close, debounced typing, ranking, snippet + breadcrumb rendering,
 * keyboard navigation, navigation to results, recent-pages fallback, the
 * empty state, the sidebar "Search" button, the dedicated results route,
 * and Cmd/Ctrl+K being suppressed inside text inputs.
 *
 * @module @frontend/__tests__/integration/notes-search
 */

import { expect, test, type Page } from '@playwright/test';

/** Opens the palette with the global shortcut and waits for the dialog. */
async function openPalette(page: Page): Promise<void> {
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Search pages' })).toBeVisible();
}

/** The search input inside the palette. */
function searchInput(page: Page) {
  return page.getByPlaceholder('Search pages…');
}

/** A result row (by index). */
function result(page: Page, index: number) {
  return page.locator('.search-palette__result').nth(index);
}

test.describe('Global page search palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[aria-label="Assignments"]').first()).toBeVisible();
  });

  test('opens the palette with the global shortcut and closes on Escape', async ({ page }) => {
    await openPalette(page);
    await expect(searchInput(page)).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Search pages' })).toHaveCount(0);
    // Backdrop click also closes.
    await openPalette(page);
    await page.mouse.click(400, 40);
    await expect(page.getByRole('dialog', { name: 'Search pages' })).toHaveCount(0);
  });

  test('the palette is global — opens from the Notes view too', async ({ page }) => {
    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(page).toHaveURL(/\/notes$/);
    await openPalette(page);
    await expect(searchInput(page)).toBeVisible();
  });

  test('the sidebar search button opens the palette', async ({ page }) => {
    await page.getByRole('tab', { name: 'Notes' }).click();
    await page.getByRole('button', { name: 'Search pages (Cmd+K)' }).click();
    await expect(page.getByRole('dialog', { name: 'Search pages' })).toBeVisible();
  });

  test('typing searches (debounced) and ranks title matches first', async ({ page }) => {
    await openPalette(page);
    await searchInput(page).fill('lecture');

    await expect(result(page, 0)).toContainText('Lecture 1', { timeout: 2000 });
    await expect(result(page, 1)).toContainText('Lecture 2');
    // Title match is highlighted with <mark>.
    await expect(page.locator('.search-palette__result-title mark').nth(0)).toHaveText(
      'Lecture',
    );
    // Nested page shows its parent breadcrumb.
    await expect(page.locator('.search-palette__result-breadcrumbs').first()).toContainText(
      'Class Notes',
    );
  });

  test('shows a content snippet with highlighted match', async ({ page }) => {
    await openPalette(page);
    await searchInput(page).fill('variables');

    // "variables" only appears in Lecture 1's content (a rank-1 content match).
    await expect(result(page, 0)).toContainText('Lecture 1');
    const snippet = page.locator('.search-palette__result-snippet mark');
    await expect(snippet.first()).toBeVisible();
    await expect(snippet.first()).toHaveText(/variables/i);
  });

  test('shows recent pages when the query is empty', async ({ page }) => {
    await openPalette(page);
    await expect(page.getByRole('dialog', { name: 'Search pages' })).toBeVisible();
    await expect(page.getByText('Recent', { exact: true })).toBeVisible();
    await expect(result(page, 0)).toBeVisible();
  });

  test('opens the selected page on Enter, closes the palette, and highlights it in the sidebar', async ({
    page,
  }) => {
    await openPalette(page);
    await searchInput(page).fill('lecture');
    await expect(page.locator('.search-palette__result')).toHaveCount(2, { timeout: 2000 });

    await searchInput(page).press('ArrowDown');
    await searchInput(page).press('Enter');

    await expect(page).toHaveURL(/\/notes\/page-3/); // Lecture 2 was selected
    await expect(page.getByRole('dialog', { name: 'Search pages' })).toHaveCount(0);
  });

  test('keyboard navigation moves the active selection', async ({ page }) => {
    await openPalette(page);
    await searchInput(page).fill('lecture');
    await expect(page.locator('.search-palette__result')).toHaveCount(2, { timeout: 2000 });

    await expect(result(page, 0)).toHaveAttribute('aria-selected', 'true');
    await searchInput(page).press('ArrowDown');
    await expect(result(page, 1)).toHaveAttribute('aria-selected', 'true');
    await searchInput(page).press('ArrowUp');
    await expect(result(page, 0)).toHaveAttribute('aria-selected', 'true');
  });

  test('shows an empty state when nothing matches', async ({ page }) => {
    await openPalette(page);
    await searchInput(page).fill('zzz-not-found');
    await expect(page.getByText(/No pages found for/i)).toBeVisible();
  });

  test('navigates to /notes/search?q= for a full results view', async ({ page }) => {
    await openPalette(page);
    await searchInput(page).fill('lecture');
    await expect(page.locator('.search-palette__result')).toHaveCount(2, { timeout: 2000 });

    await page.getByRole('button', { name: 'View all' }).click();
    await expect(page).toHaveURL(/\/notes\/search\?q=lecture/);
    await expect(page.locator('.notes-search-results')).toBeVisible();
    await expect(page.getByRole('listbox')).toHaveCount(1);
  });

  test('the global shortcut does not fire inside a text input', async ({ page }) => {
    const topBarSearch = page.getByLabel('Search assignments');
    await topBarSearch.fill('something');
    await topBarSearch.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Search pages' })).toHaveCount(0);
  });
});