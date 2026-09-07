import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/global.css';

// Install mock API for browser development (when not running in Electron)
// This must happen BEFORE any component tries to use window.api
if (import.meta.env.DEV && typeof window !== 'undefined' && !window.api) {
  // Synchronous require for mock API - it's small and dev-only
  // Using import() but we await it before rendering
  const installMock = async () => {
    try {
      await import('./mocks/mockApi');
      console.log('[Mock API] Ready');
    } catch (e) {
      console.error('[Mock API] Failed to load:', e);
    }
  };
  installMock();
}

// Lazy load App to give mock API time to install
const App = lazy(() => import('./App'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="app-loading">Loading CourseFlow…</div>}>
      <App />
    </Suspense>
  </StrictMode>,
);
