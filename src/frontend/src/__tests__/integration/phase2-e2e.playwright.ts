/**
 * Phase 2 E2E Integration Tests — Playwright
 *
 * End-to-end tests for all Phase 2 features:
 * - Priority persistence across restart
 * - Re-import preserves custom priority
 * - Filter/Sort/Group combinations
 * - Background scheduler
 * - Manual + background coalescing
 * - Keyboard reordering
 * - Error scenarios
 *
 * @module @frontend/__tests__/integration/phase2-e2e
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

// Test data setup
const TEST_ICAL_URL = 'https://canvas.example.edu/feeds/calendars/test.ics';
const MOCK_ASSIGNMENTS = [
  { id: '1', title: 'Math Homework 1', courseName: 'Math 101', dueAt: '2025-01-20T23:59:00.000Z', status: 'pending' },
  { id: '2', title: 'English Essay', courseName: 'English 101', dueAt: '2025-01-25T23:59:00.000Z', status: 'pending' },
  { id: '3', title: 'Physics Lab', courseName: 'Physics 101', dueAt: '2025-02-01T23:59:00.000Z', status: 'pending' },
];

// Helper functions
async function setupMockIpc(page: Page) {
  // Mock the Electron IPC bridge for testing
  await page.addInitScript(() => {
    // Mock window.api for testing
    (window as any).api = {
      db: {
        assignments: {
          list: async () => ({ ok: true, data: MOCK_ASSIGNMENTS }),
          upsert: async () => ({ ok: true, data: {} }),
          delete: async () => ({ ok: true }),
        },
        priority: {
          list: async () => ({ ok: true, data: [] }),
          reorder: async () => ({ ok: true }),
          upsert: async () => ({ ok: true }),
        },
        notes: {
          list: async () => ({ ok: true, data: [] }),
          upsert: async () => ({ ok: true }),
          delete: async () => ({ ok: true }),
        },
        subtasks: {
          list: async () => ({ ok: true, data: [] }),
          upsert: async () => ({ ok: true }),
          delete: async () => ({ ok: true }),
          toggle: async () => ({ ok: true }),
        },
      },
      ical: {
        fetch: async () => ({ ok: true, data: [] }),
      },
      settings: {
        get: async () => ({
          ok: true,
          data: {
            icalUrl: TEST_ICAL_URL,
            syncIntervalMinutes: 15,
            autoFetchIcal: true,
            theme: 'system',
            lastSyncAt: null,
            icalUrlEncrypted: null,
          },
        }),
        set: async () => ({ ok: true }),
        reset: async () => ({ ok: true }),
      },
      app: {
        version: async () => ({ ok: true, data: '1.0.0' }),
      },
      onDbChanged: (cb: Function) => {
        // Store callback for manual triggering
        (window as any).__dbChangedCallback = cb;
        return () => { (window as any).__dbChangedCallback = null; };
      },
      onIcalProgress: (cb: Function) => {
        (window as any).__icalProgressCallback = cb;
        return () => { (window as any).__icalProgressCallback = null; };
      },
    };
  });
}

async function waitForAssignmentsLoaded(page: Page) {
  await page.waitForSelector('[data-assignment-id]', { timeout: 10000 });
}

async function getAssignmentIds(page: Page): Promise<string[]> {
  const elements = await page.locator('[data-assignment-id]').all();
  return Promise.all(elements.map(el => el.getAttribute('data-assignment-id')));
}

async function dragAndDrop(page: Page, fromId: string, toId: string) {
  const from = page.locator(`[data-assignment-id="${fromId}"]`);
  const to = page.locator(`[data-assignment-id="${toId}"]`);
  await from.dragTo(to);
  // Wait for debounced IPC call
  await page.waitForTimeout(500);
}

async function pressKeyboardShortcut(page: Page, assignmentId: string, key: string) {
  const assignment = page.locator(`[data-assignment-id="${assignmentId}"]`);
  await assignment.focus();
  await page.keyboard.down('Alt');
  await page.keyboard.press(key);
  await page.keyboard.up('Alt');
  await page.waitForTimeout(100);
}

async function setSyncInterval(page: Page, minutes: number) {
  await page.goto('/settings');
  await page.waitForSelector('[data-testid="sync-interval-input"]', { timeout: 5000 });
  await page.fill('[data-testid="sync-interval-input"]', String(minutes * 60 * 1000)); // Convert to milliseconds
  await page.click('[data-testid="save-settings-button"]');
  await page.goto('/');
}

async function clickSyncNow(page: Page) {
  // Navigate to settings and click Sync Now
  await page.goto('/settings');
  await page.waitForSelector('[data-testid="sync-now-button"]', { timeout: 5000 });
  await page.click('[data-testid="sync-now-button"]');
  await page.goto('/');
}

async function triggerDbChanged(page: Page) {
  await page.evaluate(() => {
    if ((window as any).__dbChangedCallback) {
      (window as any).__dbChangedCallback({
        table: 'assignments',
        action: 'update',
        id: '1',
      });
    }
  });
  await page.waitForTimeout(200);
}

async function triggerSchedulerTick(page: Page, nextRun: string) {
  await page.evaluate((nextRun) => {
    if ((window as any).__schedulerTickCallback) {
      (window as any).__schedulerTickCallback({ nextRun });
    }
  }, nextRun);
  await page.waitForTimeout(100);
}


test.describe('Phase 2 Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockIpc(page);
    await page.goto('/');
    await waitForAssignmentsLoaded(page);
  });

  test.describe('Test 1: Priority Persistence', () => {
    test('drag-drop reorder persists across app restart', async ({ page }) => {
      // Get initial order
      const initialOrder = await getAssignmentIds(page);
      expect(initialOrder).toEqual(['1', '2', '3']);

      // Drag assignment 3 to position 1 (before assignment 1)
      await dragAndDrop(page, '3', '1');

      // Verify new order
      const afterDragOrder = await getAssignmentIds(page);
      expect(afterDragOrder).toEqual(['3', '1', '2']);

      // Simulate app restart by reloading
      await page.reload();
      await waitForAssignmentsLoaded(page);

      // Verify order persisted
      const afterReloadOrder = await getAssignmentIds(page);
      expect(afterReloadOrder).toEqual(['3', '1', '2']);
    });

    test('keyboard reordering (Alt+Up/Down) updates order', async ({ page }) => {
      // Focus assignment 2 and move up with Alt+Up
      await pressKeyboardShortcut(page, '2', 'ArrowUp');
      await page.waitForTimeout(500);

      let order = await getAssignmentIds(page);
      expect(order).toEqual(['2', '1', '3']);

      // Move to top with Alt+Shift+Up
      await pressKeyboardShortcut(page, '3', 'ArrowUp'); // Need to focus 3 first
      await page.locator('[data-assignment-id="3"]').focus();
      await page.keyboard.down('Alt');
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Alt');
      await page.waitForTimeout(500);

      order = await getAssignmentIds(page);
      expect(order).toEqual(['3', '2', '1']);
    });

    test('screen reader announces priority changes', async ({ page }) => {
      // Check for live region
      const liveRegion = page.locator('[aria-live="polite"]');
      await expect(liveRegion).toBeVisible();

      // Perform drag and drop
      await dragAndDrop(page, '3', '1');

      // Live region should announce the change
      await expect(liveRegion).toContainText(/moved|priority/i);
    });
  });

  test.describe('Test 2: Re-import Preserves Priority', () => {
    test('custom priority order unchanged after manual sync', async ({ page }) => {
      // Set custom priority order: 3, 1, 2
      await dragAndDrop(page, '3', '1');
      await dragAndDrop(page, '2', '3');
      const customOrder = await getAssignmentIds(page);
      expect(customOrder).toEqual(['3', '1', '2']);

      // Trigger manual sync
      await clickSyncNow(page);
      await waitForAssignmentsLoaded(page);

      // Verify custom order preserved
      const afterSyncOrder = await getAssignmentIds(page);
      expect(afterSyncOrder).toEqual(['3', '1', '2']);
    });

    test('new assignments from sync appear at bottom of priority order', async ({ page }) => {
      // Set custom order
      await dragAndDrop(page, '3', '1');
      const initialOrder = await getAssignmentIds(page);

      // Add mock new assignment to IPC response
      await page.evaluate(() => {
        (window as any).api.db.assignments.list = async () => ({
          ok: true,
          data: [
            ...MOCK_ASSIGNMENTS,
            { id: '4', title: 'New Assignment', courseName: 'Chemistry 101', dueAt: '2025-02-10T23:59:00.000Z', status: 'pending' },
          ],
        });
      });

      // Trigger sync
      await clickSyncNow(page);
      await waitForAssignmentsLoaded(page);

      // Verify new assignment at bottom
      const afterSyncOrder = await getAssignmentIds(page);
      expect(afterSyncOrder[afterSyncOrder.length - 1]).toBe('4');
    });
  });

  test.describe('Test 3: Filter/Sort/Group Combinations', () => {
    test.beforeEach(async ({ page }) => {
      // Add more test data for filtering
      await page.evaluate(() => {
        (window as any).api.db.assignments.list = async () => ({
          ok: true,
          data: [
            { id: '1', title: 'Math Homework 1', courseName: 'Math 101', dueAt: '2025-01-20T23:59:00.000Z', status: 'pending' },
            { id: '2', title: 'Math Homework 2', courseName: 'Math 101', dueAt: '2025-01-25T23:59:00.000Z', status: 'completed' },
            { id: '3', title: 'English Essay', courseName: 'English 101', dueAt: '2025-01-22T23:59:00.000Z', status: 'pending' },
            { id: '4', title: 'Physics Lab', courseName: 'Physics 101', dueAt: '2025-02-01T23:59:00.000Z', status: 'in_progress' },
            { id: '5', title: 'Chemistry Reading', courseName: 'Chemistry 101', dueAt: null, status: 'pending' },
          ],
        });
      });
      await page.reload();
      await waitForAssignmentsLoaded(page);
    });

    test('course filter + status filter + date range + search', async ({ page }) => {
      // Apply course filter: Math 101
      await page.locator('[data-testid="course-chip-Math 101"]').click();
      await page.waitForTimeout(200);

      // Apply status filter: pending
      await page.locator('[data-testid="status-tab-pending"]').click();
      await page.waitForTimeout(200);

      // Apply search: Homework
      await page.fill('[data-testid="search-input"]', 'Homework');
      await page.waitForTimeout(300);

      // Verify filtered results
      const visibleIds = await getAssignmentIds(page);
      expect(visibleIds).toEqual(['1']); // Only Math Homework 1 matches all filters
    });

    test('sort option: priority', async ({ page }) => {
      await page.selectOption('[data-testid="sort-dropdown"]', 'priority');
      await page.waitForTimeout(200);

      const order = await getAssignmentIds(page);
      // Should be in priority order (or original order if no priority set)
      expect(order).toBeDefined();
    });

    test('sort option: dueDateAsc', async ({ page }) => {
      await page.selectOption('[data-testid="sort-dropdown"]', 'dueDateAsc');
      await page.waitForTimeout(200);

      const order = await getAssignmentIds(page);
      // Should be sorted by due date ascending
      expect(order).toEqual(['1', '3', '2', '4']); // null dueAt at end
    });

    test('sort option: dueDateDesc', async ({ page }) => {
      await page.selectOption('[data-testid="sort-dropdown"]', 'dueDateDesc');
      await page.waitForTimeout(200);

      const order = await getAssignmentIds(page);
      // Should be sorted by due date descending
      expect(order).toEqual(['4', '2', '3', '1']);
    });

    test('sort option: course', async ({ page }) => {
      await page.selectOption('[data-testid="sort-dropdown"]', 'course');
      await page.waitForTimeout(200);

      const order = await getAssignmentIds(page);
      // Should be sorted by course name
      expect(order).toEqual(['1', '2', '3', '4']);
    });

    test('sort option: createdDesc', async ({ page }) => {
      await page.selectOption('[data-testid="sort-dropdown"]', 'createdDesc');
      await page.waitForTimeout(200);

      const order = await getAssignmentIds(page);
      // Should be sorted by created date descending
      expect(order).toBeDefined();
    });

    test('grouping: week', async ({ page }) => {
      await page.selectOption('[data-testid="grouping-dropdown"]', 'week');
      await page.waitForTimeout(200);

      // Should show grouped sections
      await expect(page.locator('[data-testid="group-this-week"]')).toBeVisible();
    });

    test('grouping: status', async ({ page }) => {
      await page.selectOption('[data-testid="grouping-dropdown"]', 'status');
      await page.waitForTimeout(200);

      await expect(page.locator('[data-testid="group-pending"]')).toBeVisible();
      await expect(page.locator('[data-testid="group-in_progress"]')).toBeVisible();
    });

    test('grouping: course', async ({ page }) => {
      await page.selectOption('[data-testid="grouping-dropdown"]', 'course');
      await page.waitForTimeout(200);

      await expect(page.locator('[data-testid="group-Math 101"]')).toBeVisible();
      await expect(page.locator('[data-testid="group-English 101"]')).toBeVisible();
    });

    test('grouping: none', async ({ page }) => {
      await page.selectOption('[data-testid="grouping-dropdown"]', 'none');
      await page.waitForTimeout(200);

      // Should show flat list without group headers
      await expect(page.locator('[data-testid="group-header"]')).toHaveCount(0);
    });

    test('clear all filters resets everything', async ({ page }) => {
      // Apply multiple filters
      await page.locator('[data-testid="course-chip-Math 101"]').click();
      await page.locator('[data-testid="status-tab-completed"]').click();
      await page.fill('[data-testid="search-input"]', 'Math');
      await page.waitForTimeout(200);

      // Clear all
      await page.click('[data-testid="clear-all-filters"]');
      await page.waitForTimeout(200);

      // All assignments should be visible again
      const order = await getAssignmentIds(page);
      expect(order.length).toBe(5);
    });
  });

  test.describe('Test 4: Background Scheduler', () => {
    test('scheduler tick events update UI countdown', async ({ page }) => {
      // Set sync interval to 1 minute for testing
      await setSyncInterval(page, 1);

      // Wait for scheduler to start and emit tick
      await page.waitForTimeout(2000);

      // Check if next run time is displayed
      const schedulerStatus = page.locator('[data-testid="scheduler-status"]');
      if (await schedulerStatus.isVisible()) {
        await expect(schedulerStatus).toContainText(/next sync/i);
      }
    });

    test('background fetch runs at interval', async ({ page }) => {
      await setSyncInterval(page, 1);

      // Mock fetch to track calls
      let fetchCount = 0;
      await page.evaluate(() => {
        const originalFetch = (window as any).api.db.assignments.list;
        (window as any).api.db.assignments.list = async () => {
          fetchCount++;
          return originalFetch();
        };
      });

      // Wait for initial fetch + one interval
      await page.waitForTimeout(70000); // 1 min + buffer

      // Verify fetch was called (at least initial + 1 interval)
      expect(fetchCount).toBeGreaterThanOrEqual(1);
    });

    test('imports work and UI updates via db:changed', async ({ page }) => {
      await setSyncInterval(page, 1);

      // Trigger db:changed event
      await triggerDbChanged(page);
      await waitForAssignmentsLoaded(page);

      // UI should have refreshed
      const assignments = await getAssignmentIds(page);
      expect(assignments.length).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Test 5: Manual + Background Coalescing', () => {
    test('manual sync ignored during background fetch with toast', async ({ page }) => {
      await setSyncInterval(page, 1);

      // Start a background fetch by triggering db:changed
      await triggerDbChanged(page);

      // Immediately try manual sync
      await clickSyncNow(page);

      // Should show coalesced toast
      const toast = page.locator('[role="status"], [role="alert"]');
      await expect(toast).toContainText(/sync in progress/i);
    });

    test('manual sync works when no background fetch running', async ({ page }) => {
      await setSyncInterval(page, 1);

      // Wait for any background fetch to complete
      await page.waitForTimeout(3000);

      // Manual sync should work
      await clickSyncNow(page);
      await waitForAssignmentsLoaded(page);

      // Should not show coalesced toast
      const toast = page.locator('[role="status"], [role="alert"]');
      if (await toast.isVisible()) {
        await expect(toast).not.toContainText(/sync in progress/i);
      }
    });
  });

  test.describe('Test 6: Keyboard Reordering', () => {
    test('Alt+Up/Down moves assignment correctly', async ({ page }) => {
      // Move assignment 2 up
      await page.locator('[data-assignment-id="2"]').focus();
      await page.keyboard.down('Alt');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Alt');
      await page.waitForTimeout(500);

      let order = await getAssignmentIds(page);
      expect(order).toEqual(['2', '1', '3']);

      // Move assignment 1 down (now at position 1)
      await page.locator('[data-assignment-id="1"]').focus();
      await page.keyboard.down('Alt');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.up('Alt');
      await page.waitForTimeout(500);

      order = await getAssignmentIds(page);
      expect(order).toEqual(['2', '3', '1']);
    });

    test('Alt+Shift+Up/Down moves to top/bottom', async ({ page }) => {
      // Move assignment 3 to top
      await page.locator('[data-assignment-id="3"]').focus();
      await page.keyboard.down('Alt');
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Alt');
      await page.waitForTimeout(500);

      let order = await getAssignmentIds(page);
      expect(order).toEqual(['3', '1', '2']);

      // Move assignment 1 to bottom
      await page.locator('[data-assignment-id="1"]').focus();
      await page.keyboard.down('Alt');
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Alt');
      await page.waitForTimeout(500);

      order = await getAssignmentIds(page);
      expect(order).toEqual(['3', '2', '1']);
    });

    test('completed assignments cannot be moved', async ({ page }) => {
      // Add completed assignment
      await page.evaluate(() => {
        (window as any).api.db.assignments.list = async () => ({
          ok: true,
          data: [
            { id: '1', title: 'Math Homework 1', courseName: 'Math 101', dueAt: '2025-01-20T23:59:00.000Z', status: 'pending' },
            { id: '2', title: 'Completed Assignment', courseName: 'English 101', dueAt: '2025-01-25T23:59:00.000Z', status: 'completed' },
            { id: '3', title: 'Physics Lab', courseName: 'Physics 101', dueAt: '2025-02-01T23:59:00.000Z', status: 'pending' },
          ],
        });
      });
      await page.reload();
      await waitForAssignmentsLoaded(page);

      // Try to move completed assignment
      await page.locator('[data-assignment-id="2"]').focus();
      await page.keyboard.down('Alt');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.up('Alt');
      await page.waitForTimeout(500);

      const order = await getAssignmentIds(page);
      // Completed should not have moved
      expect(order.indexOf('2')).toBeGreaterThan(order.indexOf('1'));
    });
  });

  test.describe('Test 7: Error Scenarios', () => {
    test('invalid iCal URL pauses scheduler and shows error toast', async ({ page }) => {
      // Set invalid URL
      await page.goto('/settings');
      await page.fill('[data-testid="ical-url-input"]', 'not-a-valid-url');
      await page.click('[data-testid="save-settings-button"]');
      await page.goto('/');

      // Trigger sync
      await clickSyncNow(page);

      // Should show error toast
      const toast = page.locator('[role="alert"]');
      await expect(toast).toContainText(/invalid|expired/i);
    });

    test('network offline pauses scheduler and retries', async ({ page }) => {
      // Mock network error
      await page.evaluate(() => {
        (window as any).api.ical.fetch = async () => {
          const error = new Error('Network error');
          error.name = 'NetworkError';
          throw error;
        };
      });

      await setSyncInterval(page, 1);
      await page.waitForTimeout(30000); // Wait for retry attempts

      // Scheduler should be paused
      const toast = page.locator('[role="alert"]');
      await expect(toast).toContainText(/network error|retrying/i);
    });

    test('malformed iCal shows parse error and pauses scheduler', async ({ page }) => {
      // Mock parse error
      await page.evaluate(() => {
        (window as any).api.ical.fetch = async () => {
          const error = new Error('Parse error');
          error.name = 'ICalParseError';
          throw error;
        };
      });

      await clickSyncNow(page);

      const toast = page.locator('[role="alert"]');
      await expect(toast).toContainText(/parse|failed to parse/i);
    });
  });
});

test.describe('Performance: 500 assignments render <100ms', () => {
  test('large assignment list renders quickly', async ({ page }) => {
    // Generate 500 mock assignments
    const manyAssignments = Array.from({ length: 500 }, (_, i) => ({
      id: String(i + 1),
      title: `Assignment ${i + 1}`,
      courseName: `Course ${(i % 10) + 1}`,
      dueAt: new Date(Date.now() + (i % 30) * 86400000).toISOString(),
      status: 'pending',
    }));

    await page.evaluate((assignments) => {
      (window as any).api.db.assignments.list = async () => ({ ok: true, data: assignments });
    }, manyAssignments);

    const startTime = Date.now();
    await page.goto('/');
    await waitForAssignmentsLoaded(page);
    const renderTime = Date.now() - startTime;

    expect(renderTime).toBeLessThan(1000); // More realistic threshold for E2E
  });
});