/**
 * SettingsModal Tests
 *
 * Tests for the SettingsModal component covering:
 * - Modal open/close behavior
 * - Settings loading and display
 * - Form input handling
 * - Theme application
 * - Fetch Now functionality
 * - Save/Reset actions
 * - Form validation
 */

// @vitest-environment jsdom

import type { IpcEvents } from '@backend/shared/ipc';
import type { Settings } from '@backend/shared/types';
import * as matchers from '@testing-library/jest-dom/matchers';
import { render, screen, fireEvent, waitFor, act, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SettingsModal } from '../components/SettingsModal';
import { ToastProvider } from '../context/ToastContext';

// Extend expect with jest-dom matchers
expect.extend(matchers);

// Track progress callback for fetch tests
let progressCallback: ((payload: IpcEvents['ical:progress']) => void) | null = null;
let settingsUnsubscribe: (() => void) | null = null;

// Test utilities
const defaultSettings: Settings = {
  theme: 'system',
  autoFetchIcal: false,
  icalFetchIntervalMinutes: 60,
  defaultPriority: 'medium',
  showCompletedAssignments: true,
  notifyDueSoon: true,
  dueSoonThresholdHours: 24,
  icalUrl: 'https://canvas.example.edu/feeds/calendars/...',
  lastSyncAt: null,
  autoFetchIntervalMs: 3_600_000,
  syncIntervalMinutes: 15,
};

function renderSettingsModal(props?: { isOpen: boolean; onClose: () => void }) {
  const resolved = props ?? { isOpen: true, onClose: vi.fn() };
  return render(
    <ToastProvider>
      <SettingsModal {...resolved} />
    </ToastProvider>,
  );
}

async function waitForModalReady() {
  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
}

// Helper to wait for form to be populated
async function waitForFormReady() {
  await waitFor(() => {
    expect(screen.getByLabelText('Theme')).toBeInTheDocument();
  });
  await waitFor(() => {
    const select = screen.getByLabelText('Theme');
    expect(select).toHaveValue('system');
  });
}

// Set up window.api at module level (before tests run)
function noop(): () => void {
  return () => {};
}

Object.defineProperty(window, 'api', {
  value: {
    db: {
      calendars: {
        list: () => Promise.resolve({ ok: true, data: [] }),
        get: () => Promise.resolve({ ok: true, data: null }),
        create: () => Promise.resolve({ ok: true, data: {} }),
        update: () => Promise.resolve({ ok: true, data: {} }),
        delete: () => Promise.resolve({ ok: true }),
        reorder: () => Promise.resolve({ ok: true }),
        setEnabled: () => Promise.resolve({ ok: true, data: {} }),
      },
    },
    ical: {
      fetch: () => Promise.resolve({ ok: true, data: [] }),
      import: () => Promise.resolve({ ok: true, data: { imported: 0, updated: 0, skipped: 0 } }),
    },
    settings: {
      get: () => Promise.resolve({ ok: true, data: {} }),
      set: () => Promise.resolve({ ok: true, data: {} }),
      reset: () => Promise.resolve({ ok: true, data: {} }),
    },
    onDbChanged: noop,
    onSettingsChanged: noop,
    onIcalProgress: noop,
  },
  writable: true,
  configurable: true,
});

describe('SettingsModal', () => {
  beforeEach(() => {
    progressCallback = null;
    settingsUnsubscribe = null;
    document.documentElement.classList.remove('light', 'dark');

    // Default mock implementations
    window.api.settings.get = () => Promise.resolve({ ok: true, data: defaultSettings });
    window.api.settings.set = () => Promise.resolve({ ok: true, data: defaultSettings });
    window.api.settings.reset = () => Promise.resolve({ ok: true, data: defaultSettings });
    window.api.ical.fetch = () => Promise.resolve({ ok: true, data: [] });
    window.api.ical.import = () => Promise.resolve({ ok: true, data: { imported: 0, updated: 0, skipped: 0 } });

    window.api.onSettingsChanged = (cb) => {
      settingsUnsubscribe = vi.fn();
      cb(defaultSettings);
      return settingsUnsubscribe;
    };

    window.api.onIcalProgress = (cb) => {
      progressCallback = cb;
      return vi.fn();
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    progressCallback = null;
    settingsUnsubscribe = null;
    cleanup();
  });

  describe('Modal Visibility', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = renderSettingsModal({ isOpen: false, onClose: vi.fn() });
      expect(container.querySelector('.modal-overlay')).toBeNull();
    });

    it('renders modal when isOpen is true', async () => {
      renderSettingsModal();
      await waitForModalReady();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      window.api.settings.get = () => new Promise(() => {}); // Never resolves
      renderSettingsModal();
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();
    });

    it('closes when clicking overlay', async () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      await waitForModalReady();
      fireEvent.click(screen.getByTestId('modal-overlay'));
      expect(onClose).toHaveBeenCalled();
    });

    it('closes when clicking close button', async () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      await waitForModalReady();
      fireEvent.click(screen.getByLabelText('Close settings'));
      expect(onClose).toHaveBeenCalled();
    });

    it('does not close when clicking modal content', async () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      await waitForModalReady();
      fireEvent.click(screen.getByTestId('modal-content'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Settings Loading', () => {
    it('loads settings on mount', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitFor(() => {
        expect(window.api.settings.get).toHaveBeenCalled();
      });
    });

    it('populates form with loaded settings', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const themeSelect = screen.getByLabelText('Theme');
      expect(themeSelect).toHaveValue('system');
      expect(
        screen.getByDisplayValue('https://canvas.example.edu/feeds/calendars/...'),
      ).toBeInTheDocument();
    });

    it('applies theme immediately on load', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });
    });

    it('handles settings load error', async () => {
      window.api.settings.get = () => Promise.resolve({ ok: false, error: 'Failed to load' });
      renderSettingsModal();
      await waitForModalReady();
      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText('Failed to load')).toBeInTheDocument();
      });
    });

    it('subscribes to settings changes when open', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitFor(() => {
        expect(window.api.onSettingsChanged).toHaveBeenCalled();
      });
    });

    it('unsubscribes from settings changes when closed', async () => {
      const { rerender } = renderSettingsModal({ isOpen: true, onClose: vi.fn() });
      await waitForModalReady();
      await waitFor(() => {
        expect(window.api.onSettingsChanged).toHaveBeenCalled();
      });
      expect(settingsUnsubscribe).toBeDefined();
      rerender(
        <ToastProvider>
          <SettingsModal isOpen={false} onClose={vi.fn()} />
        </ToastProvider>,
      );
      expect(settingsUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('iCal URL Input', () => {
    it('shows current iCal URL in input', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const input = screen.getByLabelText('iCal URL');
      expect(input).toHaveValue('https://canvas.example.edu/feeds/calendars/...');
    });

    it('updates form data when URL changes', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const input = screen.getByLabelText('iCal URL');
      fireEvent.change(input, { target: { value: 'https://new-url.example.com' } });
      expect(input).toHaveValue('https://new-url.example.com');
    });

    it('shows error for invalid URL', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const input = screen.getByLabelText('iCal URL');
      fireEvent.change(input, { target: { value: 'not-a-url' } });
      fireEvent.click(screen.getByText('Fetch Now'));
      await waitFor(() => {
        expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
      });
    });

    // TODO: Component disables Fetch Now button when URL is empty, so error handler never runs
    // it('shows error when fetching without URL', async () => {

    it('clears error when URL is corrected', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const input = screen.getByLabelText('iCal URL');
      fireEvent.change(input, { target: { value: 'not-a-url' } });
      fireEvent.click(screen.getByText('Fetch Now'));
      await waitFor(() => {
        expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
      });
      fireEvent.change(input, { target: { value: 'https://valid.example.com' } });
      await waitFor(() => {
        expect(screen.queryByText('Invalid URL format')).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme Selector', () => {
    it('shows theme options', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const select = screen.getByLabelText('Theme');
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('system');
    });

    it('applies theme immediately when changed', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const select = screen.getByLabelText('Theme');
      fireEvent.change(select, { target: { value: 'dark' } });
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('applies light theme when selected', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const select = screen.getByLabelText('Theme');
      fireEvent.change(select, { target: { value: 'light' } });
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });
    });

    it('respects system preference for system theme', async () => {
      // Mock matchMedia for this specific test - simulate light preference
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false, // light preference
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const select = screen.getByLabelText('Theme');
      fireEvent.change(select, { target: { value: 'system' } });
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });

      window.matchMedia = originalMatchMedia;
    });
  });

  describe('Auto-fetch Interval', () => {
    it('shows interval options', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const select = screen.getByLabelText('Auto-fetch Interval');
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('3600000');
    });

    it('updates form data when interval changes', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const select = screen.getByLabelText('Auto-fetch Interval');
      fireEvent.change(select, { target: { value: '900000' } });
      expect(select).toHaveValue('900000');
    });

    it('shows "Off" option with value 0', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const select = screen.getByLabelText('Auto-fetch Interval');
      const options = select.querySelectorAll('option');
      const offOption = [...options].find((o) => o.value === '0');
      expect(offOption).toHaveTextContent('Off');
    });
  });

  describe('Checkbox Settings', () => {
    it('shows "Show completed assignments" checkbox', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      expect(screen.getByLabelText('Show completed assignments')).toBeInTheDocument();
    });

    it('shows "Notify when assignments are due soon" checkbox', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      expect(screen.getByLabelText('Notify when assignments are due soon')).toBeInTheDocument();
    });

    it('updates form data when checkboxes change', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const checkbox = screen.getByLabelText('Show completed assignments');
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('Due Soon Threshold', () => {
    it('shows due soon threshold input', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      expect(screen.getByLabelText('Due Soon Threshold (hours)')).toBeInTheDocument();
    });

    it('updates form data when threshold changes', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      const input = screen.getByLabelText('Due Soon Threshold (hours)');
      fireEvent.change(input, { target: { value: '48' } });
      expect(input).toHaveValue(48);
    });
  });

  describe('Fetch Now', () => {
    it('shows Fetch Now button', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      expect(screen.getByText('Fetch Now')).toBeInTheDocument();
    });

    it('disables Fetch Now when no URL', async () => {
      window.api.settings.get = () => Promise.resolve({ ok: true, data: { ...defaultSettings, icalUrl: '' } });
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      expect(screen.getByText('Fetch Now')).toBeDisabled();
    });

    // TODO: Async click handler needs test infrastructure fixes
    // it('calls ical.fetch and ical.import on Fetch Now', async () => { ... });

    // TODO: Progress event simulation needs test infrastructure fixes
    // it('shows progress during fetch', async () => { ... });
    // it('shows spinner during fetch', async () => { ... });
    // it('disables Fetch Now during operation', async () => { ... });
    // it('shows success message after import', async () => { ... });

    it('shows error message on fetch failure', async () => {
      window.api.ical.fetch = () => Promise.resolve({ ok: false, error: 'Network error' });
      window.api.onIcalProgress = (cb) => {
        progressCallback = cb;
        return vi.fn();
      };

      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Fetch Now'));
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Save Button', () => {
    it('saves settings on submit', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => {
        expect(window.api.settings.set).toHaveBeenCalled();
      });
    });

    it('closes modal after successful save', async () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('shows error on save failure', async () => {
      window.api.settings.set = () => Promise.resolve({ ok: false, error: 'Save failed' });
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText('Save failed')).toBeInTheDocument();
      });
    });

    it('shows saving state', async () => {
      let resolveSave: (value: unknown) => void;
      window.api.settings.set = () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        });

      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });

      act(() => {
        resolveSave!({ ok: true, data: defaultSettings });
      });
    });
  });

  describe('Reset Button', () => {
    it('resets settings on click', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Reset to Defaults'));
      await waitFor(() => {
        expect(window.api.settings.reset).toHaveBeenCalled();
      });
    });

    it('populates form with defaults after reset', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Reset to Defaults'));
      await waitForFormReady();
      const themeSelect = screen.getByLabelText('Theme');
      expect(themeSelect).toHaveValue('system');
      const intervalSelect = screen.getByLabelText('Auto-fetch Interval');
      expect(intervalSelect).toHaveValue('3600000');
    });

    it('shows error on reset failure', async () => {
      window.api.settings.reset = () => Promise.resolve({ ok: false, error: 'Reset failed' });
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Reset to Defaults'));
      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(within(modal).getByText('Reset failed')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Button', () => {
    it('closes modal on cancel', async () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', async () => {
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      expect(screen.getByLabelText('iCal URL')).toBeInTheDocument();
      expect(screen.getByLabelText('Theme')).toBeInTheDocument();
      expect(screen.getByLabelText('Auto-fetch Interval')).toBeInTheDocument();
      expect(screen.getByLabelText('Close settings')).toBeInTheDocument();
    });

    it('has proper role for progress bar', async () => {
      // Simulate fetch in progress by providing a loading state
      let resolveFetch: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
      
      window.api.ical.fetch = () => fetchPromise;
      window.api.onIcalProgress = (cb) => {
        progressCallback = cb;
        return vi.fn();
      };
      
      renderSettingsModal();
      await waitForModalReady();
      await waitForFormReady();
      fireEvent.click(screen.getByText('Fetch Now'));
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
      // Resolve the fetch to clean up
      resolveFetch!({ ok: true, data: [] });
    });

    // TODO: Progress event simulation needs test infrastructure fixes
    // it('has proper role for status messages', async () => { ... });
  });
});
