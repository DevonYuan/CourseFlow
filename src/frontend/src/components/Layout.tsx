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

import { TopBar } from './TopBar';
import { Toolbar } from './Toolbar';
import './Layout.css';

interface LayoutProps {
  /** Child content to render in the main area */
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  return (
    <div className="layout">
      {/* Window Chrome */}
      <div className="window">
        {/* Primary Bar: Brand, Tabs, Search, Sync, Settings */}
        <TopBar />

        {/* Toolbar: Filters, Sort, Group, View Toggle */}
        <Toolbar />

        {/* Content Area */}
        <main className="layout__main" role="main" tabIndex={-1}>
          <div className="layout__content">{children}</div>
        </main>
      </div>
    </div>
  );
}
