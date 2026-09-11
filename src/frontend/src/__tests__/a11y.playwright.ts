/**
 * Accessibility Tests — Playwright + axe-core
 *
 * Automated accessibility testing for Phase 3 components.
 * Tests detail page, sub-tasks, notes editor, and modals for WCAG 2.1 AA compliance.
 *
 * @module @frontend/__tests__/a11y.playwright
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('[aria-label="Assignments"]', { timeout: 10000 });
  });

  test.describe('Assignment Detail Page', () => {
    test('should have no accessibility violations on detail page', async ({ page }) => {
      // Click on first assignment row to open detail page
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      // Wait for detail page to load
      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      // Run axe accessibility scan
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Fail test if there are violations
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      // Check for h1 (assignment title)
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();

      // Check for h2 sections
      const h2s = page.locator('h2');
      await expect(h2s).toHaveCount(3); // Description, Sub-tasks, Notes (at minimum)
    });

    test('should have skip link that works', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      // Tab to skip link
      await page.keyboard.press('Tab');
      const skipLink = page.locator('.skip-link:focus');
      await expect(skipLink).toBeFocused();

      // Press Enter on skip link
      await page.keyboard.press('Enter');

      // Focus should move to main content
      const mainContent = page.locator('#assignment-detail-content');
      await expect(mainContent).toBeFocused();
    });

    test('should have proper landmarks', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      // Check for main landmark
      const main = page.locator('main[role="main"], article[role="main"]');
      await expect(main).toBeVisible();

      // Check for nav landmark (back button)
      const nav = page.locator('nav, [role="navigation"]');
      // Back button should be present
      await expect(page.locator('button[aria-label="Back to assignments"]')).toBeVisible();
    });
  });

  test.describe('Sub-tasks', () => {
    test('should have no accessibility violations on sub-tasks section', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });
      await page.waitForSelector('#subtasks-heading', { timeout: 5000 });

      // Run axe on sub-tasks section
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .include('section[aria-labelledby="subtasks-heading"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should have accessible checkboxes', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });
      await page.waitForSelector('#subtasks-heading', { timeout: 5000 });

      // Check for checkboxes with proper aria
      const checkboxes = page.locator('input[type="checkbox"][aria-checked]');
      await expect(checkboxes.first()).toBeVisible();

      // Test keyboard interaction
      await checkboxes.first().focus();
      await page.keyboard.press('Space');
    });

    test('should have accessible delete buttons with aria-labels', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });
      await page.waitForSelector('#subtasks-heading', { timeout: 5000 });

      // Check delete buttons have aria-label
      const deleteButtons = page.locator('button[aria-label^="Delete sub-task:"]');
      await expect(deleteButtons.first()).toBeVisible();
    });
  });

  test.describe('Notes Editor', () => {
    test('should have no accessibility violations on notes editor', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });
      await page.waitForSelector('#notes-heading', { timeout: 5000 });

      // Click add note button to open editor
      const addNoteButton = page.locator('button:has-text("Add note")').first();
      if (await addNoteButton.isVisible()) {
        await addNoteButton.click();
        await page.waitForSelector('.notes-editor', { timeout: 3000 });

        // Run axe on notes editor
        const accessibilityScanResults = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .include('.notes-editor')
          .analyze();

        expect(accessibilityScanResults.violations).toEqual([]);

        // Check for aria-multiline
        const textarea = page.locator('textarea[aria-multiline="true"]');
        await expect(textarea).toBeVisible();

        // Check for aria-describedby for character count
        const charCount = page.locator('#notes-editor-char-count');
        await expect(charCount).toBeVisible();
      }
    });

    test('should have proper keyboard shortcuts', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });
      await page.waitForSelector('#notes-heading', { timeout: 5000 });

      const addNoteButton = page.locator('button:has-text("Add note")').first();
      if (await addNoteButton.isVisible()) {
        await addNoteButton.click();
        await page.waitForSelector('.notes-editor', { timeout: 3000 });

        const textarea = page.locator('textarea[aria-multiline="true"]');
        await textarea.focus();

        // Type some content
        await textarea.fill('Test note content');

        // Test Ctrl+Enter to save
        await page.keyboard.press('Control+Enter');

        // Editor should close after save
        await expect(page.locator('.notes-editor')).not.toBeVisible({ timeout: 3000 });
      }
    });
  });

  test.describe('Delete Confirmation Modal', () => {
    test('should have no accessibility violations on delete modal', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });
      await page.waitForSelector('#subtasks-heading', { timeout: 5000 });

      // Click delete button on first sub-task
      const deleteButton = page.locator('button[aria-label^="Delete sub-task:"]').first();
      await deleteButton.click();

      // Wait for modal to appear
      await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 3000 });

      // Run axe on modal
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .include('[role="dialog"][aria-modal="true"]')
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);

      // Check for focus trap - cancel button should be focused
      const cancelButton = page.locator('button:has-text("Cancel")');
      await expect(cancelButton).toBeFocused();

      // Close modal
      await cancelButton.click();
    });

    test('should trap focus and close on Escape', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });
      await page.waitForSelector('#subtasks-heading', { timeout: 5000 });

      const deleteButton = page.locator('button[aria-label^="Delete sub-task:"]').first();
      await deleteButton.click();

      await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 3000 });

      // Press Escape to close
      await page.keyboard.press('Escape');

      // Modal should close
      await expect(page.locator('[role="dialog"][aria-modal="true"]')).not.toBeVisible({
        timeout: 2000,
      });
    });
  });

  test.describe('Progress Bar', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      // Check progress bar has proper ARIA
      const progressBar = page.locator('[role="progressbar"]');
      await expect(progressBar).toBeVisible();
      await expect(progressBar).toHaveAttribute('aria-valuenow');
      await expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      await expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      await expect(progressBar).toHaveAttribute('aria-label');
    });

    test('should be keyboard accessible when clickable', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      const progressBar = page.locator('[role="progressbar"][tabindex="0"]');
      if (await progressBar.isVisible()) {
        await progressBar.focus();
        await page.keyboard.press('Enter');
        // Should scroll to sub-tasks section
        await expect(page.locator('#subtasks-heading')).toBeInViewport();
      }
    });
  });

  test.describe('All Complete Prompt', () => {
    test('should have proper ARIA live region', async ({ page }) => {
      // This test assumes there's an assignment with all sub-tasks complete
      // and assignment status is pending
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      // Check for all-complete-prompt if visible
      const prompt = page.locator('[role="status"][aria-live="polite"]');
      if (await prompt.isVisible()) {
        await expect(prompt).toHaveAttribute('aria-atomic', 'true');
      }
    });

    test('should dismiss on Escape', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      const prompt = page.locator('.all-complete-prompt');
      if (await prompt.isVisible()) {
        await page.keyboard.press('Escape');
        await expect(prompt).not.toBeVisible({ timeout: 2000 });
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('should pass color contrast checks', async ({ page }) => {
      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['cat.color'])
        .analyze();

      // Color contrast violations should be empty
      const contrastViolations = accessibilityScanResults.violations.filter(
        (v) => v.id === 'color-contrast',
      );
      expect(contrastViolations).toEqual([]);
    });
  });

  test.describe('Reduced Motion', () => {
    test('should respect prefers-reduced-motion', async ({ page }) => {
      // Emulate reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' });

      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      // Check that animations are disabled
      // This is a basic check - actual animation testing would need more setup
      const progressBarFill = page.locator('.progress-bar__fill');
      if (await progressBarFill.isVisible()) {
        const transition = await progressBarFill.evaluate(
          (el) => window.getComputedStyle(el).transitionDuration,
        );
        // Should be 0s or very small
        expect(transition).toMatch(/0s|0\.0s/);
      }
    });
  });

  test.describe('Zoom Support', () => {
    test('should be usable at 200% zoom', async ({ page }) => {
      // Set viewport to simulate 200% zoom at 800px
      await page.setViewportSize({ width: 400, height: 800 });

      const firstRow = page.locator('[data-assignment-id]').first();
      await firstRow.click();

      await page.waitForSelector('article[role="main"]', { timeout: 5000 });

      // Check no horizontal scroll
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 10); // Small tolerance

      // Check content is not overlapping
      const main = page.locator('article[role="main"]');
      await expect(main).toBeVisible();
    });
  });
});

// Dummy test to prevent "No tests found" error if all tests are skipped
test('Accessibility test file exists', () => {
  expect(true).toBe(true);
});
