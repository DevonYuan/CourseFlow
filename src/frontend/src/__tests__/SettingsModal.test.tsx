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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { SettingsModal } from '../components/SettingsModal';
import type { Settings } from '@backend/shared/types';

// Mock window.api
const mockApi = {
  settings: {
    get: vi.fn(),
    set: vi.fn(),
    reset: vi.fn(),
  },
  ical: {
    fetch: vi.fn(),
    import: vi.fn(),
  },
  onSettingsChanged: vi.fn(),
  onIcalProgress: vi.fn(),
};

Object.defineProperty(window, 'api', {
  value: mockApi,
  writable: true,
  configurable: true,
});

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
  autoFetchIntervalMs: 3600000,
};

function renderSettingsModal(props: { isOpen: boolean; onClose: () => void } = { isOpen: true, onClose: vi.fn() }) {
  return render(<SettingsModal {...props} />);
}

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('light', 'dark');
    
    // Default mock implementations
    mockApi.settings.get.mockResolvedValue({ ok: true, data: defaultSettings });
    mockApi.settings.set.mockResolvedValue({ ok: true, data: defaultSettings });
    mockApi.settings.reset.mockResolvedValue({ ok: true, data: defaultSettings });
    mockApi.ical.fetch.mockResolvedValue({ ok: true, data: [] });
    mockApi.ical.import.mockResolvedValue({ ok: true, data: { imported: 0, updated: 0, skipped: 0 } });
    mockApi.onSettingsChanged.mockImplementation((cb) => cb(defaultSettings));
    mockApi.onIcalProgress.mockImplementation((cb) => vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Modal Visibility', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = renderSettingsModal({ isOpen: false, onClose: vi.fn() });
      expect(container.querySelector('.modal-overlay')).toBeNull();
    });

    it('renders modal when isOpen is true', () => {
      renderSettingsModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      mockApi.settings.get.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderSettingsModal();
      expect(screen.getByText('Loading settings...')).toBeInTheDocument();
    });

    it('closes when clicking overlay', () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      fireEvent.click(screen.getByTestId('modal-overlay'));
      expect(onClose).toHaveBeenCalled();
    });

    it('closes when clicking close button', () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      fireEvent.click(screen.getByLabelText('Close settings'));
      expect(onClose).toHaveBeenCalled();
    });

    it('does not close when clicking modal content', () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      fireEvent.click(screen.getByTestId('modal-content'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Settings Loading', () => {
    it('loads settings on mount', async () => {
      renderSettingsModal();
      await waitFor(() => {
        expect(mockApi.settings.get).toHaveBeenCalled();
      });
    });

    it('populates form with loaded settings', async () => {
      renderSettingsModal();
      await waitFor(() => {
        expect(screen.getByDisplayValue('https://canvas.example.edu/feeds/calendars/...')).toBeInTheDocument();
        expect(screen.getByDisplayValue('system')).toBeInTheDocument();
      });
    });

    it('applies theme immediately on load', async () => {
      renderSettingsModal();
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });
    });

    it('handles settings load error', async () => {
      mockApi.settings.get.mockResolvedValue({ ok: false, error: 'Failed to load' });
      renderSettingsModal();
      await waitFor(() => {
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
      });
    });

    it('subscribes to settings changes when open', async () => {
      renderSettingsModal();
      await waitFor(() => {
        expect(mockApi.onSettingsChanged).toHaveBeenCalled();
      });
    });

    it('unsubscribes from settings changes when closed', async () => {
      const { rerender } = renderSettingsModal();
      await waitFor(() => {
        expect(mockApi.onSettingsChanged).toHaveBeenCalled();
      });
      const unsubscribe = mockApi.onSettingsChanged.mock.results[0]?.value;
      expect(unsubscribe).toBeDefined();
      rerender(<SettingsModal isOpen={false} onClose={vi.fn()} />);
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('iCal URL Input', () => {
    it('shows current iCal URL in input', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const input = screen.getByLabelText('iCal URL');
        expect(input).toHaveValue('https://canvas.example.edu/feeds/calendars/...');
      });
    });

    it('updates form data when URL changes', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const input = screen.getByLabelText('iCal URL');
        fireEvent.change(input, { target: { value: 'https://new-url.example.com' } });
        expect(input).toHaveValue('https://new-url.example.com');
      });
    });

    it('shows error for invalid URL', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const input = screen.getByLabelText('iCal URL');
        fireEvent.change(input, { target: { value: 'not-a-url' } });
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
      });
    });

    it('shows error when fetching without URL', async () => {
      mockApi.settings.get.mockResolvedValue({ ok: true, data: { ...defaultSettings, icalUrl: '' } });
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(screen.getByText('Please enter an iCal URL first')).toBeInTheDocument();
      });
    });

    it('clears error when URL is corrected', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const input = screen.getByLabelText('iCal URL');
        fireEvent.change(input, { target: { value: 'not-a-url' } });
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
      });
      await waitFor(() => {
        const input = screen.getByLabelText('iCal URL');
        fireEvent.change(input, { target: { value: 'https://valid.example.com' } });
        expect(screen.queryByText('Invalid URL format')).not.toBeInTheDocument();
      });
    });
  });

  describe('Theme Selector', () => {
    it('shows theme options', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const select = screen.getByLabelText('Theme');
        expect(select).toBeInTheDocument();
        expect(screen.getByDisplayValue('system')).toBeInTheDocument();
      });
    });

    it('applies theme immediately when changed', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const select = screen.getByLabelText('Theme');
        fireEvent.change(select, { target: { value: 'dark' } });
      });
      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('applies light theme when selected', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const select = screen.getByLabelText('Theme');
        fireEvent.change(select, { target: { value: 'light' } });
      });
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });
    });

    it('respects system preference for system theme', async () => {
      // Mock matchMedia for this specific test
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      
      renderSettingsModal();
      await waitFor(() => {
        const select = screen.getByLabelText('Theme');
        fireEvent.change(select, { target: { value: 'system' } });
      });
      await waitFor(() => {
        expect(document.documentElement.classList.contains('light')).toBe(true);
      });
      
      window.matchMedia = originalMatchMedia;
    });
  });

  describe('Auto-fetch Interval', () => {
    it('shows interval options', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const select = screen.getByLabelText('Auto-fetch Interval');
        expect(select).toBeInTheDocument();
        expect(screen.getByDisplayValue('3600000')).toBeInTheDocument(); // 1 hour default
      });
    });

    it('updates form data when interval changes', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const select = screen.getByLabelText('Auto-fetch Interval');
        fireEvent.change(select, { target: { value: '900000' } }); // 15 minutes
        expect(select).toHaveValue('900000');
      });
    });

    it('shows "Off" option with value 0', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const select = screen.getByLabelText('Auto-fetch Interval');
        const options = select.querySelectorAll('option');
        const offOption = Array.from(options).find((o) => o.value === '0');
        expect(offOption).toHaveTextContent('Off');
      });
    });
  });

  describe('Checkbox Settings', () => {
    it('shows "Show completed assignments" checkbox', async () => {
      renderSettingsModal();
      await waitFor(() => {
        expect(screen.getByLabelText('Show completed assignments')).toBeInTheDocument();
      });
    });

    it('shows "Notify when assignments are due soon" checkbox', async () => {
      renderSettingsModal();
      await waitFor(() => {
        expect(screen.getByLabelText('Notify when assignments are due soon')).toBeInTheDocument();
      });
    });

    it('updates form data when checkboxes change', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const checkbox = screen.getByLabelText('Show completed assignments');
        fireEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
      });
    });
  });

  describe('Due Soon Threshold', () => {
    it('shows due soon threshold input', async () => {
      renderSettingsModal();
      await waitFor(() => {
        expect(screen.getByLabelText('Due Soon Threshold (hours)')).toBeInTheDocument();
      });
    });

    it('updates form data when threshold changes', async () => {
      renderSettingsModal();
      await waitFor(() => {
        const input = screen.getByLabelText('Due Soon Threshold (hours)');
        fireEvent.change(input, { target: { value: '48' } });
        expect(input).toHaveValue('48');
      });
    });
  });

  describe('Fetch Now', () => {
    it('shows Fetch Now button', async () => {
      renderSettingsModal();
      await waitFor(() => {
        expect(screen.getByText('Fetch Now')).toBeInTheDocument();
      });
    });

    it('disables Fetch Now when no URL', async () => {
      mockApi.settings.get.mockResolvedValue({ ok: true, data: { ...defaultSettings, icalUrl: '' } });
      renderSettingsModal();
      await waitFor(() => {
        expect(screen.getByText('Fetch Now')).toBeDisabled();
      });
    });

    it('calls ical.fetch and ical.import on Fetch Now', async () => {
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(mockApi.ical.fetch).toHaveBeenCalledWith('https://canvas.example.edu/feeds/calendars/...');
      });
      await waitFor(() => {
        expect(mockApi.ical.import).toHaveBeenCalled();
      });
    });

    it('shows progress during fetch', async () => {
      let progressCallback: (payload: { stage: string; progress: number; message?: string }) => void;
      mockApi.onIcalProgress.mockImplementation((cb) => {
        progressCallback = cb;
        return vi.fn();
      });

      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Fetch Now'));
      });

      await waitFor(() => {
        act(() => {
          progressCallback!({ stage: 'fetch', progress: 33, message: 'Fetching...' });
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Fetching...')).toBeInTheDocument();
      });
    });

    it('shows spinner during fetch', async () => {
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('disables Fetch Now during operation', async () => {
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(screen.getByText('Fetching...')).toBeDisabled();
      });
    });

    it('shows success message after import', async () => {
      mockApi.ical.import.mockResolvedValue({ 
        ok: true, 
        data: { imported: 5, updated: 2, skipped: 1 } 
      });

      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(screen.getByText('Imported: 5 new, 2 updated, 1 skipped')).toBeInTheDocument();
      });
    });

    it('shows error message on fetch failure', async () => {
      mockApi.ical.fetch.mockResolvedValue({ ok: false, error: 'Network error' });

      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Save Button', () => {
    it('saves settings on submit', async () => {
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Save'));
      });
      await waitFor(() => {
        expect(mockApi.settings.set).toHaveBeenCalled();
      });
    });

    it('closes modal after successful save', async () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      await waitFor(() => {
        fireEvent.click(screen.getByText('Save'));
      });
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('shows error on save failure', async () => {
      mockApi.settings.set.mockResolvedValue({ ok: false, error: 'Save failed' });
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Save'));
      });
      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });
    });

    it('shows saving state', async () => {
      let resolveSave: (value: unknown) => void;
      mockApi.settings.set.mockImplementation(() => new Promise((resolve) => {
        resolveSave = resolve;
      }));

      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Save'));
      });
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
      await waitFor(() => {
        fireEvent.click(screen.getByText('Reset to Defaults'));
      });
      await waitFor(() => {
        expect(mockApi.settings.reset).toHaveBeenCalled();
      });
    });

    it('populates form with defaults after reset', async () => {
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Reset to Defaults'));
      });
      await waitFor(() => {
        expect(screen.getByDisplayValue('system')).toBeInTheDocument();
        expect(screen.getByDisplayValue('3600000')).toBeInTheDocument();
      });
    });

    it('shows error on reset failure', async () => {
      mockApi.settings.reset.mockResolvedValue({ ok: false, error: 'Reset failed' });
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Reset to Defaults'));
      });
      await waitFor(() => {
        expect(screen.getByText('Reset failed')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Button', () => {
    it('closes modal on cancel', async () => {
      const onClose = vi.fn();
      renderSettingsModal({ isOpen: true, onClose });
      await waitFor(() => {
        fireEvent.click(screen.getByText('Cancel'));
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', async () => {
      renderSettingsModal();
      await waitFor(() => {
        expect(screen.getByLabelText('iCal URL')).toBeInTheDocument();
        expect(screen.getByLabelText('Theme')).toBeInTheDocument();
        expect(screen.getByLabelText('Auto-fetch Interval')).toBeInTheDocument();
        expect(screen.getByLabelText('Close settings')).toBeInTheDocument();
      });
    });

    it('has proper role for progress bar', async () => {
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('has proper role for status messages', async () => {
      renderSettingsModal();
      await waitFor(() => {
        fireEvent.click(screen.getByText('Fetch Now'));
      });
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });
  });
});