import type { Settings } from '@backend/shared/types';
import React, { useState } from 'react';
import { useState as useReactState, useEffect, useCallback } from 'react';

import { useToast } from '../context/ToastContext';
import { useIcalSync } from '../hooks/useIcalSync';
import { applyTheme } from '../utils/theme';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Collapsible help panel with platform-specific iCal URL examples */
function IcalUrlHelp() {
  const [expanded, setExpanded] = useState(false);

  return (
    <details className="ical-help" open={expanded}>
      <summary onClick={() => setExpanded(!expanded)} className="ical-help__summary">
        <span className="ical-help__icon">{expanded ? '▼' : '▶'}</span>
        <span>Where to find your iCal URL</span>
      </summary>
      <div className="ical-help__content">
        <div className="ical-help__platform">
          <h4>Google Calendar</h4>
          <ol>
            <li>Open Google Calendar on desktop</li>
            <li>
              Click ⋮ next to your calendar → <strong>Settings and sharing</strong>
            </li>
            <li>
              Scroll to <strong>Integrate calendar</strong>
            </li>
            <li>
              Copy <strong>Secret address in iCal format</strong> (looks like{' '}
              <code>https://calendar.google.com/calendar/ical/.../private-XXXX/basic.ics</code>)
            </li>
            <li>
              <em>Or enable "Make available to public" and use the Public URL</em>
            </li>
          </ol>
        </div>
        <div className="ical-help__platform">
          <h4>Canvas LMS</h4>
          <ol>
            <li>
              Open Canvas → <strong>Calendar</strong> (left sidebar)
            </li>
            <li>
              Right sidebar: click <strong>Calendar Feed</strong>
            </li>
            <li>
              Copy the URL (looks like{' '}
              <code>https://school.instructure.com/feeds/calendars/user_XXXX_YYYY.ics</code>)
            </li>
            <li>
              <em>Note: Some institutions disable this feature</em>
            </li>
          </ol>
        </div>
        <div className="ical-help__platform">
          <h4>Outlook / Office 365</h4>
          <ol>
            <li>Open Outlook on the web</li>
            <li>
              Right-click your calendar → <strong>Sharing and permissions</strong>
            </li>
            <li>Set "Can view all details" for the person/link</li>
            <li>
              Copy the <strong>ICS</strong> link under "Publish this calendar"
            </li>
            <li>
              (Looks like <code>https://outlook.office.com/owa/calendar/.../calendar.ics</code>)
            </li>
          </ol>
        </div>
        <div className="ical-help__platform">
          <h4>Apple Calendar (iCloud)</h4>
          <ol>
            <li>Open iCloud.com → Calendar</li>
            <li>
              Click the ⛭ next to calendar → <strong>Public Calendar</strong>
            </li>
            <li>
              Enable and copy the <strong>.ics</strong> link
            </li>
          </ol>
        </div>
        <div className="ical-help__platform">
          <h4>Other / Manual .ics file</h4>
          <p>
            If your platform isn't listed, look for "Export", "Subscribe", "iCal feed", "Calendar
            feed", or ".ics" in your calendar settings.
          </p>
        </div>
      </div>
    </details>
  );
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Settings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const { success: toastSuccess, error: toastError } = useToast();

  const {
    isLoading: isSyncing,
    progress,
    stage,
    message,
    error: syncError,
    lastResult,
    fetchAndImport,
    reset: resetSync,
  } = useIcalSync();

  // Apply theme immediately when it changes in form
  useEffect(() => {
    if (formData.theme) {
      applyTheme(formData.theme);
    }
  }, [formData.theme]);

  // Load settings on mount and when modal opens
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.api.settings.get();
      if (result.ok) {
        setSettings(result.data);
        setFormData(result.data);
        // Apply theme on load
        applyTheme(result.data.theme);
      } else {
        setError(result.error);
        toastError(result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      toastError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  // Listen for external settings changes
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = window.api.onSettingsChanged((newSettings: Settings) => {
      setSettings(newSettings);
      setFormData(newSettings);
    });
    return unsubscribe;
  }, [isOpen]);

  const handleInputChange = (key: keyof Settings, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // The interval dropdown edits autoFetchIntervalMs (0 = Off). Translate it
      // into the fields the scheduler actually reads before persisting.
      const intervalMs = Number(formData.autoFetchIntervalMs ?? 0);
      const intervalMinutes = intervalMs > 0 ? Math.round(intervalMs / 60_000) : 0;
      const payload: Partial<Settings> = {
        ...formData,
        autoFetchIcal: intervalMinutes > 0,
        syncIntervalMinutes: intervalMinutes,
        icalFetchIntervalMinutes: intervalMinutes,
      };
      // autoFetchIntervalMs is computed from icalFetchIntervalMinutes and not stored
      delete payload.autoFetchIntervalMs;

      const result = await window.api.settings.set(payload);
      if (result.ok) {
        setSettings(result.data);
        setFormData(result.data);
        toastSuccess('Settings saved');
        onClose();
      } else {
        setError(result.error);
        toastError(result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
      toastError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await window.api.settings.reset();
      if (result.ok) {
        setSettings(result.data);
        setFormData(result.data);
        toastSuccess('Settings reset to defaults');
      } else {
        setError(result.error);
        toastError(result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(errorMessage);
      toastError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <p>Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" data-testid="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        data-testid="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="settings-title">Settings</h2>
          <button className="close-button" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="modal-content">
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <div className="form-group">
              <label htmlFor="icalUrl">iCal URL</label>
              <input
                id="icalUrl"
                type="url"
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                value={formData.icalUrl || ''}
                onChange={(e) => {
                  handleInputChange('icalUrl', e.target.value);
                  setUrlError(null);
                }}
                disabled={isSaving || isSyncing}
                aria-invalid={!!urlError}
                aria-describedby={urlError ? 'icalUrl-error' : 'icalUrl-help'}
                data-testid="ical-url-input"
              />
              {urlError && (
                <small id="icalUrl-error" className="error-text" role="alert">
                  {urlError}
                </small>
              )}
              <small id="icalUrl-help" className="help-text">
                Paste any iCal feed URL (Google Calendar, Canvas, Outlook, etc.)
              </small>
              <IcalUrlHelp />
            </div>

            {/* Fetch Now Section */}
            <div className="form-group">
              <label htmlFor="fetchNow">Fetch & Import</label>
              <div className="fetch-now-group">
                <button
                  id="fetchNow"
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const url = formData.icalUrl?.trim();
                    if (!url) {
                      setUrlError('Please enter an iCal URL first');
                      return;
                    }
                    try {
                      new URL(url);
                    } catch {
                      setUrlError('Invalid URL format');
                      return;
                    }
                    fetchAndImport(url)
                      .then(() => {
                        if (lastResult) {
                          toastSuccess(
                            `Synced: ${lastResult.imported} new, ${lastResult.updated} updated, ${lastResult.skipped} skipped`,
                          );
                        }
                      })
                      .catch(() => {
                        if (syncError) {
                          toastError(syncError);
                        }
                      });
                  }}
                  disabled={isSaving || isSyncing || !formData.icalUrl?.trim()}
                  aria-busy={isSyncing}
                  data-testid="sync-now-button"
                >
                  {isSyncing ? (
                    <>
                      <span className="spinner" aria-hidden="true"></span>
                      {stage === 'fetch' && 'Fetching...'}
                      {stage === 'parse' && 'Parsing...'}
                      {stage === 'store' && 'Importing...'}
                      {!stage || (stage === 'idle' && 'Working...')}
                    </>
                  ) : (
                    'Fetch Now'
                  )}
                </button>
                {isSyncing && (
                  <div
                    className="fetch-progress"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Fetch and import progress"
                  >
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <small className="progress-message">{message}</small>
                  </div>
                )}
                {lastResult && !isSyncing && (
                  <div className="fetch-result success" role="status">
                    Imported: {lastResult.imported} new, {lastResult.updated} updated,{' '}
                    {lastResult.skipped} skipped
                  </div>
                )}
                {syncError && !isSyncing && (
                  <div className="fetch-result error" role="alert">
                    {syncError}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="theme">Theme</label>
              <select
                id="theme"
                value={formData.theme || 'system'}
                onChange={(e) => handleInputChange('theme', e.target.value)}
                disabled={isSaving}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="autoFetchIntervalMs">Auto-fetch Interval</label>
              <select
                id="autoFetchIntervalMs"
                value={formData.autoFetchIntervalMs || 3_600_000}
                onChange={(e) =>
                  handleInputChange('autoFetchIntervalMs', Number.parseInt(e.target.value, 10))
                }
                disabled={isSaving}
                data-testid="sync-interval-input"
              >
                <option value={0}>Off</option>
                <option value={900_000}>15 minutes</option>
                <option value={1_800_000}>30 minutes</option>
                <option value={3_600_000}>1 hour</option>
                <option value={21_600_000}>6 hours</option>
                <option value={43_200_000}>12 hours</option>
                <option value={86_400_000}>24 hours</option>
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.showCompletedAssignments ?? true}
                  onChange={(e) => handleInputChange('showCompletedAssignments', e.target.checked)}
                  disabled={isSaving}
                />
                Show completed assignments
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.notifyDueSoon ?? true}
                  onChange={(e) => handleInputChange('notifyDueSoon', e.target.checked)}
                  disabled={isSaving}
                />
                Notify when assignments are due soon
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="dueSoonThresholdHours">Due Soon Threshold (hours)</label>
              <input
                id="dueSoonThresholdHours"
                type="number"
                min="1"
                max="168"
                value={formData.dueSoonThresholdHours || 24}
                onChange={(e) =>
                  handleInputChange('dueSoonThresholdHours', Number.parseInt(e.target.value, 10))
                }
                disabled={isSaving}
              />
            </div>

            {/* Keyboard Shortcuts Help */}
            <details className="keyboard-shortcuts-help" open={false}>
              <summary className="keyboard-shortcuts__summary">Keyboard Shortcuts</summary>
              <div className="keyboard-shortcuts__content">
                <div className="keyboard-shortcuts__section">
                  <h4>Global</h4>
                  <dl className="keyboard-shortcuts__list">
                    <div className="keyboard-shortcuts__item">
                      <kbd>?</kbd>
                      <dd>Show this help</dd>
                    </div>
                    <div className="keyboard-shortcuts__item">
                      <kbd>Esc</kbd>
                      <dd>Close modal / Clear input / Dismiss prompt</dd>
                    </div>
                  </dl>
                </div>
                <div className="keyboard-shortcuts__section">
                  <h4>Assignment List</h4>
                  <dl className="keyboard-shortcuts__list">
                    <div className="keyboard-shortcuts__item">
                      <kbd>↑ / ↓</kbd>
                      <dd>Navigate between assignments</dd>
                    </div>
                    <div className="keyboard-shortcuts__item">
                      <kbd>Enter</kbd>
                      <dd>Open assignment detail</dd>
                    </div>
                    <div className="keyboard-shortcuts__item">
                      <kbd>Alt + ↑ / ↓</kbd>
                      <dd>Reorder priority (move up/down)</dd>
                    </div>
                  </dl>
                </div>
                <div className="keyboard-shortcuts__section">
                  <h4>Assignment Detail</h4>
                  <dl className="keyboard-shortcuts__list">
                    <div className="keyboard-shortcuts__item">
                      <kbd>Tab</kbd>
                      <dd>Navigate between elements</dd>
                    </div>
                    <div className="keyboard-shortcuts__item">
                      <kbd>Space / Enter</kbd>
                      <dd>Toggle sub-task completion</dd>
                    </div>
                    <div className="keyboard-shortcuts__item">
                      <kbd>Enter</kbd>
                      <dd>Save sub-task / note</dd>
                    </div>
                    <div className="keyboard-shortcuts__item">
                      <kbd>Esc</kbd>
                      <dd>Dismiss all-complete prompt / Close modal</dd>
                    </div>
                  </dl>
                </div>
                <div className="keyboard-shortcuts__section">
                  <h4>Notes Editor</h4>
                  <dl className="keyboard-shortcuts__list">
                    <div className="keyboard-shortcuts__item">
                      <kbd>Ctrl + Enter</kbd>
                      <dd>Save note (⌘+Enter on Mac)</dd>
                    </div>
                    <div className="keyboard-shortcuts__item">
                      <kbd>Esc</kbd>
                      <dd>Cancel editing</dd>
                    </div>
                    <div className="keyboard-shortcuts__item">
                      <kbd>Tab</kbd>
                      <dd>Insert tab character (indentation)</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </details>

            <div className="modal-actions">
              <button type="button" className="secondary" onClick={handleReset} disabled={isSaving}>
                Reset to Defaults
              </button>
              <button type="button" className="secondary" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={isSaving}
                data-testid="save-settings-button"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
