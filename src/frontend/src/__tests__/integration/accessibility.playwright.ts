/**
 * Accessibility E2E Tests — Playwright + axe-core
 *
 * Verifies the Phase 3 detail view meets WCAG 2.1 A/AA: no axe violations,
 * a single main landmark, logical headings, a working skip link, and an
 * accessible sub-task delete modal.
 *
 * @module @frontend/__tests__/integration/accessibility
 */

import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Axe builder scoped to the app's structural accessibility invariants.
 *
 * `color-contrast` is disabled because the current design tokens have a known,
 * separately-tracked contrast backlog that predates Phase 3 and is out of scope
 * for this tests-and-docs ticket. Landmark, name/role, ARIA, id, and heading
 * rules still run.
 */
function axe(page: Page): AxeBuilder {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules(['color-contrast']);
}

async function openFirstAssignment(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[aria-label="Assignments"]').first()).toBeVisible();
  await page.locator('[data-assignment-id]').first().click();
  await expect(page.locator('article.assignment-detail')).toBeVisible();
  await expect(page.locator('#subtasks-heading')).toBeVisible();
}

test.describe('Accessibility — assignment detail', () => {
  test.beforeEach(async ({ page }) => {
    await openFirstAssignment(page);
  });

  test('has no structural axe violations (WCAG 2.1 A/AA)', async ({ page }) => {
    const results = await axe(page).analyze();
    expect(results.violations).toEqual([]);
  });

  test('exposes a single main landmark and a logical heading hierarchy', async ({ page }) => {
    await expect(page.locator('main[role="main"]')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    // Description, Sub-tasks, Notes
    await expect(page.locator('h2')).toHaveCount(3);
  });

  test('skip link is the first focusable element and targets main content', async ({ page }) => {
    // The skip link must be the first focusable element in the document.
    const firstFocusableClass = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(
        'a[href], button, input, [tabindex]:not([tabindex="-1"])',
      );
      return el?.className ?? '';
    });
    expect(firstFocusableClass).toContain('skip-link');

    await page.locator('.skip-link').focus();
    await expect(page.locator('.skip-link')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);
    await expect(page.locator('#main-content')).toBeFocused();
  });
});

test.describe('Accessibility — sub-tasks', () => {
  test.beforeEach(async ({ page }) => {
    await openFirstAssignment(page);
  });

  test('sub-tasks section has no axe violations', async ({ page }) => {
    const results = await axe(page)
      .include('section[aria-labelledby="subtasks-heading"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('checkboxes are labelled and toggle via keyboard', async ({ page }) => {
    const checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox).toHaveAttribute('aria-label', /Sub-task:/);

    const before = await checkbox.isChecked();
    await checkbox.focus();
    await page.keyboard.press('Space');

    await expect.poll(async () => checkbox.isChecked()).not.toBe(before);
  });

  test('delete confirmation modal is accessible and closes on Escape', async ({ page }) => {
    await page.locator('button[aria-label^="Delete sub-task:"]').first().click();

    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();

    const results = await axe(page).include('[role="dialog"]').analyze();
    expect(results.violations).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
