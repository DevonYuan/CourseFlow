import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { useIcalSync } from '../hooks/useIcalSync';
import { useToast } from '../context/ToastContext';
import './SettingsModal.css';
/**
 * Apply theme to document element immediately.
 */
function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
        // Check if matchMedia is available and has matches property (may not be in test environment)
        const mediaQuery = typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-color-scheme: dark)')
            : null;
        const prefersDark = mediaQuery?.matches ?? false;
        root.classList.add(prefersDark ? 'dark' : 'light');
    }
    else {
        root.classList.add(theme);
    }
}
export function SettingsModal({ isOpen, onClose }) {
    const [settings, setSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({});
    const [isSaving, setIsSaving] = useState(false);
    const [urlError, setUrlError] = useState(null);
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
            }
            else {
                setError(result.error);
                toastError(result.error);
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
            setError(errorMessage);
            toastError(errorMessage);
        }
        finally {
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
        if (!isOpen)
            return;
        const unsubscribe = window.api.onSettingsChanged((newSettings) => {
            setSettings(newSettings);
            setFormData(newSettings);
        });
        return unsubscribe;
    }, [isOpen]);
    const handleInputChange = (key, value) => {
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
            }
            else {
                setError(result.error);
                toastError(result.error);
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
            setError(errorMessage);
            toastError(errorMessage);
        }
        finally {
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
            }
            else {
                setError(result.error);
                toastError(result.error);
            }
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
            setError(errorMessage);
            toastError(errorMessage);
        }
        finally {
            setIsSaving(false);
        }
    };
    if (!isOpen)
        return null;
    if (isLoading) {
        return (_jsx("div", { className: "modal-overlay", onClick: onClose, children: _jsx("div", { className: "modal", onClick: e => e.stopPropagation(), children: _jsx("div", { className: "modal-content", children: _jsx("p", { children: "Loading settings..." }) }) }) }));
    }
    return (_jsx("div", { className: "modal-overlay", "data-testid": "modal-overlay", onClick: onClose, children: _jsxs("div", { className: "modal", "data-testid": "modal-content", role: "dialog", "aria-modal": "true", "aria-labelledby": "settings-title", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h2", { id: "settings-title", children: "Settings" }), _jsx("button", { className: "close-button", onClick: onClose, "aria-label": "Close settings", children: "\u00D7" })] }), _jsxs("div", { className: "modal-content", children: [error && (_jsx("div", { className: "error-message", role: "alert", children: error })), _jsxs("form", { onSubmit: e => { e.preventDefault(); handleSave(); }, children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "icalUrl", children: "iCal URL" }), _jsx("input", { id: "icalUrl", type: "url", placeholder: "https://canvas.institution.edu/feeds/calendars/...", value: formData.icalUrl || '', onChange: (e) => {
                                                handleInputChange('icalUrl', e.target.value);
                                                setUrlError(null);
                                            }, disabled: isSaving || isSyncing, "aria-invalid": !!urlError, "aria-describedby": urlError ? 'icalUrl-error' : undefined }), urlError && (_jsx("small", { id: "icalUrl-error", className: "error-text", role: "alert", children: urlError })), _jsx("small", { className: "help-text", children: "Your Canvas calendar iCal feed URL" })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "fetchNow", children: "Fetch & Import" }), _jsxs("div", { className: "fetch-now-group", children: [_jsx("button", { id: "fetchNow", type: "button", className: "secondary", onClick: () => {
                                                        const url = formData.icalUrl?.trim();
                                                        if (!url) {
                                                            setUrlError('Please enter an iCal URL first');
                                                            return;
                                                        }
                                                        try {
                                                            new URL(url);
                                                        }
                                                        catch {
                                                            setUrlError('Invalid URL format');
                                                            return;
                                                        }
                                                        fetchAndImport(url)
                                                            .then(() => {
                                                            if (lastResult) {
                                                                toastSuccess(`Synced: ${lastResult.imported} new, ${lastResult.updated} updated, ${lastResult.skipped} skipped`);
                                                            }
                                                        })
                                                            .catch(() => {
                                                            if (syncError) {
                                                                toastError(syncError);
                                                            }
                                                        });
                                                    }, disabled: isSaving || isSyncing || !formData.icalUrl?.trim(), "aria-busy": isSyncing, children: isSyncing ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "spinner", "aria-hidden": "true" }), stage === 'fetch' && 'Fetching...', stage === 'parse' && 'Parsing...', stage === 'store' && 'Importing...', !stage || stage === 'idle' && 'Working...'] })) : ('Fetch Now') }), isSyncing && (_jsxs("div", { className: "fetch-progress", role: "progressbar", "aria-valuenow": progress, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": "Fetch and import progress", children: [_jsx("div", { className: "progress-bar", children: _jsx("div", { className: "progress-fill", style: { width: `${progress}%` } }) }), _jsx("small", { className: "progress-message", children: message })] })), lastResult && !isSyncing && (_jsxs("div", { className: "fetch-result success", role: "status", children: ["Imported: ", lastResult.imported, " new, ", lastResult.updated, " updated, ", lastResult.skipped, " skipped"] })), syncError && !isSyncing && (_jsx("div", { className: "fetch-result error", role: "alert", children: syncError }))] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "theme", children: "Theme" }), _jsxs("select", { id: "theme", value: formData.theme || 'system', onChange: e => handleInputChange('theme', e.target.value), disabled: isSaving, children: [_jsx("option", { value: "system", children: "System" }), _jsx("option", { value: "light", children: "Light" }), _jsx("option", { value: "dark", children: "Dark" })] })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "autoFetchIntervalMs", children: "Auto-fetch Interval" }), _jsxs("select", { id: "autoFetchIntervalMs", value: formData.autoFetchIntervalMs || 3600000, onChange: e => handleInputChange('autoFetchIntervalMs', parseInt(e.target.value, 10)), disabled: isSaving, children: [_jsx("option", { value: 0, children: "Off" }), _jsx("option", { value: 900000, children: "15 minutes" }), _jsx("option", { value: 1800000, children: "30 minutes" }), _jsx("option", { value: 3600000, children: "1 hour" }), _jsx("option", { value: 21600000, children: "6 hours" }), _jsx("option", { value: 43200000, children: "12 hours" }), _jsx("option", { value: 86400000, children: "24 hours" })] })] }), _jsx("div", { className: "form-group checkbox-group", children: _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: formData.showCompletedAssignments ?? true, onChange: e => handleInputChange('showCompletedAssignments', e.target.checked), disabled: isSaving }), "Show completed assignments"] }) }), _jsx("div", { className: "form-group checkbox-group", children: _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: formData.notifyDueSoon ?? true, onChange: e => handleInputChange('notifyDueSoon', e.target.checked), disabled: isSaving }), "Notify when assignments are due soon"] }) }), _jsxs("div", { className: "form-group", children: [_jsx("label", { htmlFor: "dueSoonThresholdHours", children: "Due Soon Threshold (hours)" }), _jsx("input", { id: "dueSoonThresholdHours", type: "number", min: "1", max: "168", value: formData.dueSoonThresholdHours || 24, onChange: e => handleInputChange('dueSoonThresholdHours', parseInt(e.target.value, 10)), disabled: isSaving })] }), _jsxs("div", { className: "modal-actions", children: [_jsx("button", { type: "button", className: "secondary", onClick: handleReset, disabled: isSaving, children: "Reset to Defaults" }), _jsx("button", { type: "button", className: "secondary", onClick: onClose, disabled: isSaving, children: "Cancel" }), _jsx("button", { type: "submit", className: "primary", disabled: isSaving, children: isSaving ? 'Saving...' : 'Save' })] })] })] })] }) }));
}
//# sourceMappingURL=SettingsModal.js.map