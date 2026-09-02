import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AssignmentListPage } from './pages/AssignmentListPage';
import { SettingsPage } from './pages/SettingsPage';
import { useSettings } from './hooks/useSettings';

function ThemedApp(): JSX.Element {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings) {
      document.documentElement.setAttribute('data-theme', settings.theme);
    }
  }, [settings?.theme]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Layout>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AssignmentListPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </BrowserRouter>
        </Layout>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default ThemedApp;
