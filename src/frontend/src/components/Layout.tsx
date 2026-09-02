/**
 * Layout Component
 *
 * Wrapper component providing the main page structure with TopBar and main content area.
 *
 * @module @frontend/components/Layout
 */

import { TopBar } from './TopBar';
import './Layout.css';

interface LayoutProps {
  /** Child content to render in the main area */
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  return (
    <div className="layout">
      <TopBar />
      <main className="layout__main" role="main" tabIndex={-1}>
        <div className="layout__content">{children}</div>
      </main>
    </div>
  );
}