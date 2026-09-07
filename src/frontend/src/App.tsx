import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import { useSettings } from './hooks/useSettings';
import { AssignmentDetailPage } from './pages/AssignmentDetailPage';
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
              <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {/* In production the app is served from file:// so the initial
                  location is the index.html path (not "/"). Redirect anything
                  unmatched to the assignment list. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default ThemedApp;
