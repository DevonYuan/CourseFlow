import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '@backend/shared/types';
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

  // Load settings on mount and when modal opens
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.api.settings.get();
      if (result.ok) {
        setSettings(result.data);
        setFormData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  // Listen for external settings changes
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = window.api.onSettingsChanged((newSettings) => {
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
        onClose();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
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
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
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
                onChange={e => handleInputChange('icalUrl', e.target.value)}
                disabled={isSaving}
              />
              <small className="help-text">Your Canvas calendar iCal feed URL</small>
            </div>

            <div className="form-group">
              <label htmlFor="theme">Theme</label>
              <select
                id="theme"
                value={formData.theme || 'system'}
                onChange={e => handleInputChange('theme', e.target.value as 'light' | 'dark' | 'system')}
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
                value={formData.autoFetchIntervalMs || 3600000}
                onChange={e => handleInputChange('autoFetchIntervalMs', parseInt(e.target.value, 10))}
                disabled={isSaving}
              >
                <option value={0}>Off</option>
                <option value={900000}>15 minutes</option>
                <option value={1800000}>30 minutes</option>
                <option value={3600000}>1 hour</option>
                <option value={21600000}>6 hours</option>
                <option value={43200000}>12 hours</option>
                <option value={86400000}>24 hours</option>
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
                onChange={e => handleInputChange('dueSoonThresholdHours', parseInt(e.target.value, 10))}
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
              <button type="submit" className="primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}