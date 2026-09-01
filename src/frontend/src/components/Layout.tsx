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
  /** Callback when settings should be opened */
  onOpenSettings: () => void;
  /** Callback when show completed toggle changes */
  onToggleShowCompleted: (show: boolean) => void;
}

export function Layout({
  children,
  onOpenSettings,
  onToggleShowCompleted,
}: LayoutProps): JSX.Element {
  return (
    <div className="layout">
      <TopBar
        onOpenSettings={onOpenSettings}
        onToggleShowCompleted={onToggleShowCompleted}
      />
      <main className="layout__main" role="main" tabIndex={-1}>
        <div className="layout__content">{children}</div>
      </main>
    </div>
  );
}