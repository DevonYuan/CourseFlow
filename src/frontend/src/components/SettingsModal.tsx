import type { Settings } from '@backend/shared/types';
import React from 'react';
import { useState, useEffect, useCallback } from 'react';

import { useToast } from '../context/ToastContext';
import { useIcalSync } from '../hooks/useIcalSync';
import { applyTheme } from '../utils/theme';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Settings>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const { success: toastSuccess, error: toastError } = useToast();

  const { isLoading: isSyncing, progress, stage, message, error: syncError, lastResult, fetchAndImport, reset: resetSync } = useIcalSync();

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
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await window.api.settings.set(formData);
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
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <p>Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" data-testid="modal-overlay" onClick={onClose}>
      <div className="modal" data-testid="modal-content" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()}>
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

          <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
            <div className="form-group">
              <label htmlFor="icalUrl">iCal URL</label>
              <input
                id="icalUrl"
                type="url"
                placeholder="https://canvas.institution.edu/feeds/calendars/..."
                value={formData.icalUrl || ''}
                onChange={(e) => {
                  handleInputChange('icalUrl', e.target.value);
                  setUrlError(null);
                }}
                disabled={isSaving || isSyncing}
                aria-invalid={!!urlError}
                aria-describedby={urlError ? 'icalUrl-error' : undefined}
                data-testid="ical-url-input"
              />
              {urlError && (
                <small id="icalUrl-error" className="error-text" role="alert">
                  {urlError}
                </small>
              )}
              <small className="help-text">Your Canvas calendar iCal feed URL</small>
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
                            `Synced: ${lastResult.imported} new, ${lastResult.updated} updated, ${lastResult.skipped} skipped`
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
                      {!stage || stage === 'idle' && 'Working...'}
                    </>
                  ) : (
                    'Fetch Now'
                  )}
                </button>
                {isSyncing && (
                  <div className="fetch-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Fetch and import progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <small className="progress-message">{message}</small>
                  </div>
                )}
                {lastResult && !isSyncing && (
                  <div className="fetch-result success" role="status">
                    Imported: {lastResult.imported} new, {lastResult.updated} updated, {lastResult.skipped} skipped
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
                onChange={e => handleInputChange('theme', e.target.value)}
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
                onChange={e => handleInputChange('autoFetchIntervalMs', Number.parseInt(e.target.value, 10))}
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
                  onChange={e => handleInputChange('showCompletedAssignments', e.target.checked)}
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
                  onChange={e => handleInputChange('notifyDueSoon', e.target.checked)}
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
                onChange={e => handleInputChange('dueSoonThresholdHours', Number.parseInt(e.target.value, 10))}
                disabled={isSaving}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="secondary" onClick={handleReset} disabled={isSaving}>
                Reset to Defaults
              </button>
              <button type="button" className="secondary" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={isSaving} data-testid="save-settings-button">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}