/**
 * Notes Sidebar E2E — Playwright
 *
 * Covers the Notes workspace sidebar against the browser mock API:
 * view switcher, tree rendering, expand/collapse, create, rename, delete,
 * keyboard navigation, and keyboard-driven reordering.
 *
 * @module @frontend/__tests__/integration/notes-sidebar
 */

import { test, expect, type Page } from '@playwright/test';

async function openNotes(page: Page): Promise<void> {
  await page.goto('/notes');
  await expect(page.locator('.notes-sidebar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
}

/** Returns the sidebar treeitem whose text contains `title`. */
function treeItem(page: Page, title: string) {
  return page.locator('.notes-sidebar [role="treeitem"]', { hasText: title }).first();
}

test.describe('Notes sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await openNotes(page);
  });

  test('renders the seeded root pages', async ({ page }) => {
    // Root pages are visible; nested children are hidden until expanded.
    await expect(treeItem(page, 'Class Notes')).toBeVisible();
    await expect(treeItem(page, 'Ideas')).toBeVisible();
    await expect(page.locator('.notes-sidebar [role="treeitem"]')).toHaveCount(2);
    await expect(treeItem(page, 'Lecture 1')).toHaveCount(0);
  });

  test('expands and collapses a page', async ({ page }) => {
    await treeItem(page, 'Class Notes').getByRole('button', { name: 'Expand' }).click();

    await expect(treeItem(page, 'Lecture 1')).toBeVisible();
    await expect(treeItem(page, 'Lecture 2')).toBeVisible();
    // Expanded row uses aria-expanded + correct level on children.
    await expect(treeItem(page, 'Class Notes')).toHaveAttribute('aria-expanded', 'true');
    await expect(treeItem(page, 'Lecture 1')).toHaveAttribute('aria-level', '2');

    await treeItem(page, 'Class Notes').getByRole('button', { name: 'Collapse' }).click();
    await expect(treeItem(page, 'Lecture 1')).toHaveCount(0);
  });

  test('persists expanded state across reloads', async ({ page }) => {
    await treeItem(page, 'Class Notes').getByRole('button', { name: 'Expand' }).click();
    await expect(treeItem(page, 'Lecture 1')).toBeVisible();

    await page.reload();
    await expect(page.locator('.notes-sidebar')).toBeVisible();
    await expect(treeItem(page, 'Lecture 1')).toBeVisible();
  });

  test('creates a new page and inline-renames it', async ({ page }) => {
    await page.getByRole('button', { name: 'Create new page' }).click();

    const renameInput = page.locator('.notes-sidebar input[aria-label="Page title"]');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('My New Page');
    await renameInput.press('Enter');

    await expect(treeItem(page, 'My New Page')).toBeVisible();
    await expect(page).toHaveURL(/\/notes\/.+/);
  });

  test('renames an existing page with F2', async ({ page }) => {
    await treeItem(page, 'Ideas').focus();
    await page.keyboard.press('F2');

    const renameInput = page.locator('.notes-sidebar input[aria-label="Page title"]');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Random Thoughts');
    await renameInput.press('Enter');

    await expect(treeItem(page, 'Random Thoughts')).toBeVisible();
  });

  test('deletes a page after confirming', async ({ page }) => {
    await treeItem(page, 'Ideas').getByRole('button', { name: 'Actions for Ideas' }).click();
    await page.getByRole('menuitem', { name: /Delete/ }).click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(treeItem(page, 'Ideas')).toHaveCount(0);
    await expect(page.locator('.notes-sidebar [role="treeitem"]')).toHaveCount(1);
  });

  test('navigates between pages with the keyboard', async ({ page }) => {
    await treeItem(page, 'Class Notes').focus();
    await page.keyboard.press('ArrowDown');

    // Focus should have moved to the second root row.
    await expect(treeItem(page, 'Ideas')).toBeFocused();
  });

  test('reorders pages by dragging', async ({ page }) => {
    const sourceHandle = treeItem(page, 'Class Notes').locator('.page-tree-node__drag-handle');
    const sourceBox = await sourceHandle.boundingBox();
    const targetBox = await treeItem(page, 'Ideas').boundingBox();
    if (!sourceBox || !targetBox) throw new Error('Missing drag geometry');

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    // Exceed the 8px PointerSensor activation threshold.
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + 30, { steps: 5 });
    // Drop in the bottom band of the "Ideas" row to insert after it.
    await page.mouse.move(targetBox.x + 20, targetBox.y + targetBox.height - 3, { steps: 10 });
    await page.mouse.up();

    // "Class Notes" and "Ideas" swap order.
    await expect(page.locator('.notes-sidebar [role="treeitem"]').first()).toContainText('Ideas');
  });

  test('duplicates a page and its descendants with Ctrl+D', async ({ page }) => {
    await treeItem(page, 'Class Notes').focus();
    await page.keyboard.press('Control+d');

    // Root duplicate is prefixed and selected/navigated to.
    await expect(treeItem(page, 'Copy of Class Notes')).toBeVisible();
    await expect(page).toHaveURL(/\/notes\/.+/);
    await expect(page.locator('.notes-sidebar [role="treeitem"]')).toHaveCount(3);
  });

  test('switches between Assignments and Notes views', async ({ page }) => {
    await page.getByRole('tab', { name: 'Assignments' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.notes-sidebar')).not.toBeVisible();

    await page.getByRole('tab', { name: 'Notes' }).click();
    await expect(page).toHaveURL(/\/notes/);
    await expect(page.locator('.notes-sidebar')).toBeVisible();
  });

  test('creates a new subfolder under the selected page', async ({ page }) => {
    await treeItem(page, 'Ideas').click();
    await expect(page).toHaveURL(/\/notes\/page-4/);

    await page.getByRole('button', { name: 'New subfolder' }).click();

    const renameInput = page.locator('.notes-sidebar input[aria-label="Page title"]');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Projects');
    await renameInput.press('Enter');

    // The parent auto-expands so the nested folder is visible one level down.
    await expect(treeItem(page, 'Projects')).toBeVisible();
    await expect(treeItem(page, 'Projects')).toHaveAttribute('aria-level', '2');
  });

  test('creates a top-level folder when no page is selected', async ({ page }) => {
    await page.getByRole('button', { name: 'New subfolder' }).click();

    const renameInput = page.locator('.notes-sidebar input[aria-label="Page title"]');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Archive');
    await renameInput.press('Enter');

    await expect(treeItem(page, 'Archive')).toBeVisible();
    await expect(treeItem(page, 'Archive')).toHaveAttribute('aria-level', '1');
  });
});
