import { useCallback, useState } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { AssignmentList } from './components/AssignmentList';
import { Layout } from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import { useSettings } from './hooks/useSettings';

export function App(): JSX.Element {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { settings, updateSettings } = useSettings();

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleToggleShowCompleted = useCallback(
    (show: boolean) => {
      updateSettings({ showCompletedAssignments: show });
    },
    [updateSettings],
  );

  return (
    <ToastProvider>
      <Layout
        onOpenSettings={handleOpenSettings}
        onToggleShowCompleted={handleToggleShowCompleted}
      >
        <AssignmentList onOpenSettings={handleOpenSettings} />
      </Layout>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </ToastProvider>
  );
}
