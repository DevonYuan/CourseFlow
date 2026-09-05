import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import { useSettings } from './hooks/useSettings';
import { AssignmentListPage } from './pages/AssignmentListPage';
import { SettingsPage } from './pages/SettingsPage';
import { applyTheme } from './utils/theme';

function ThemedApp(): JSX.Element {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings) {
      applyTheme(settings.theme);
    }
  }, [settings?.theme]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<AssignmentListPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default ThemedApp;
