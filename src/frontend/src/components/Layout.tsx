/**
 * Layout Component
 *
 * Wrapper component providing the main page structure with window chrome,
 * primary bar (brand, tabs, search, sync), toolbar (filters, sort, group),
 * and main content area.
 * Matches: docs/design-inspo/courseflow-dashbar-redesign.html
 *
 * @module @frontend/components/Layout
 */

import { useLocation } from 'react-router-dom';

import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';
import './Layout.css';

interface LayoutProps {
  /** Child content to render in the main area */
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  const { pathname } = useLocation();
  const isNotesView = pathname.startsWith('/notes');

  return (
    <div className="layout">
      {/* Skip link must be the first focusable element in the document */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {/* Window Chrome */}
      <div className="window">
        {/* Primary Bar: Brand, Tabs, Search, Sync, Settings */}
        <TopBar />

        {/* Toolbar: Filters, Sort, Group, View Toggle (assignment list only) */}
        {!isNotesView && <Toolbar />}

        {/* Content Area — the notes workspace is a full-bleed split pane, so
            it drops the content padding/width cap to let the sidebar divider
            run the full height of the window. */}
        <main
          id="main-content"
          className={`layout__main${isNotesView ? ' layout__main--flush' : ''}`}
          role="main"
          tabIndex={-1}
        >
          <div className={`layout__content${isNotesView ? ' layout__content--flush' : ''}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
