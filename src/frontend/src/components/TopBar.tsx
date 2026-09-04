/**
 * TopBar Component
 *
 * Fixed header with app title, sync status, show completed toggle, and settings button.
 *
 * @module @frontend/components/TopBar
 */

import { useNavigate } from 'react-router-dom';

import { useSettings } from '../hooks/useSettings';

import { SyncStatusIndicator } from './SyncStatusIndicator';
import './TopBar.css';

export function TopBar(): JSX.Element {
  const navigate = useNavigate();
  const { settings, isLoading, updateSettings } = useSettings();

  const handleToggleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ showCompletedAssignments: event.target.checked });
  };

  const handleOpenSettings = () => {
    navigate('/settings');
  };

  if (isLoading || !settings) {
    return (
      <header className="top-bar" role="banner">
        <div className="top-bar__inner">
          <h1 className="top-bar__title">CourseFlow</h1>
          <div className="top-bar__center" aria-busy="true">
            <span className="top-bar__loading">Loading...</span>
          </div>
          <div className="top-bar__actions" />
        </div>
      </header>
    );
  }

  return (
    <header className="top-bar" role="banner">
      <div className="top-bar__inner">
        <h1 className="top-bar__title">
          <a href="/" className="top-bar__title-link" onClick={(e) => e.preventDefault()}>
            CourseFlow
          </a>
        </h1>

        <nav className="top-bar__center" aria-label="Sync status">
          <SyncStatusIndicator />
        </nav>

        <div className="top-bar__actions">
          <label className="top-bar__toggle" htmlFor="show-completed">
            <input
              type="checkbox"
              id="show-completed"
              checked={settings.showCompletedAssignments}
              onChange={handleToggleChange}
              className="top-bar__toggle-input"
              aria-label="Show completed assignments"
            />
            <span className="top-bar__toggle-text">Show Completed</span>
          </label>

          <button
            className="top-bar__settings-btn"
            onClick={handleOpenSettings}
            aria-label="Open settings"
            type="button"
          >
            <svg
              className="top-bar__settings-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}