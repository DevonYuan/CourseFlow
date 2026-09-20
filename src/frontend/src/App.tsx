import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { PageEditor } from './components/notes/PageEditor';
import { SearchPalette } from './components/notes/SearchPalette';
import { FocusRestorationProvider } from './context/FocusRestorationContext';
import { ToastProvider } from './context/ToastContext';
import { useSettings } from './hooks/useSettings';
import { initializeAssignmentsStore } from './store/assignmentsStore';
import { initializeCalendarsStore } from './stores/calendarsStore';
import { AssignmentDetailPage } from './pages/AssignmentDetailPage';
import { AssignmentListPage } from './pages/AssignmentListPage';
import { NotesSearchResults } from './pages/NotesSearchResults';
import { NotesWorkspace, NotesWelcome } from './pages/NotesWorkspace';
import { SettingsPage } from './pages/SettingsPage';
import { applyTheme } from './utils/theme';

export function ThemedApp(): JSX.Element {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings) {
      applyTheme(settings.theme);
    }
  }, [settings]);

  useEffect(() => {
    initializeAssignmentsStore();
    initializeCalendarsStore();
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <FocusRestorationProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<AssignmentListPage />} />
                <Route path="/assignments/:id" element={<AssignmentDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* Notes Workspace */}
                <Route path="/notes" element={<NotesWorkspace />}>
                  <Route index element={<NotesWelcome />} />
                  <Route path="search" element={<NotesSearchResults />} />
                  <Route path=":pageId" element={<PageEditor />} />
                </Route>
                {/* In production the app is served from file:// so the initial
                  location is the index.html path (not "/"). Redirect anything
                  unmatched to the assignment list. */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
            {/* Global search overlay — mounted once so Cmd+K works everywhere. */}
            <SearchPalette />
          </FocusRestorationProvider>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}
