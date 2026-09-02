import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useState } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { AssignmentList } from './components/AssignmentList';
import { Layout } from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSettings } from './hooks/useSettings';
export function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const { settings, updateSettings } = useSettings();
    const handleOpenSettings = useCallback(() => {
        setIsSettingsOpen(true);
    }, []);
    const handleToggleShowCompleted = useCallback((show) => {
        updateSettings({ showCompletedAssignments: show });
    }, [updateSettings]);
    return (_jsx(ErrorBoundary, { children: _jsxs(ToastProvider, { children: [_jsx(Layout, { onOpenSettings: handleOpenSettings, onToggleShowCompleted: handleToggleShowCompleted, children: _jsx(AssignmentList, { onOpenSettings: handleOpenSettings }) }), _jsx(SettingsModal, { isOpen: isSettingsOpen, onClose: () => setIsSettingsOpen(false) })] }) }));
}
//# sourceMappingURL=App.js.map