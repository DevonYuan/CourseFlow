/**
 * TopBar Component — Primary Bar (Row 1)
 *
 * Brand, Status Tabs, Search, Sync Pill, Settings.
 * Matches design: docs/design-inspo/courseflow-dashbar-redesign.html
 *
 * @module @frontend/components/TopBar
 */

import { useLocation, useNavigate } from 'react-router-dom';

import {
  useStatusFilter,
  useSetStatusFilter,
  useSearchQuery,
  useSetSearchQuery,
} from '../store/assignmentsStore';

import { SyncStatusIndicator } from './SyncStatusIndicator';
import './TopBar.css';

function handleSyncClick(): void {
  // Trigger manual sync via IPC
  void window.api.scheduler.trigger?.();
}

export function TopBar(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const isNotesView = location.pathname.startsWith('/notes');
  const statusFilter = useStatusFilter();
  const setStatusFilter = useSetStatusFilter();
  const searchQuery = useSearchQuery();
  const setSearchQuery = useSetSearchQuery();

  const handleTabChange = (event: React.MouseEvent<HTMLButtonElement>) => {
    const tab = event.currentTarget.textContent?.toLowerCase() || 'all';
    switch (tab) {
      case 'all': {
        setStatusFilter('all');

        break;
      }
      case 'pending': {
        setStatusFilter('pending');

        break;
      }
      case 'completed': {
        setStatusFilter('completed');

        break;
      }
      // No default
    }
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleOpenSettings = () => {
    void navigate('/settings');
  };

  // We don't have isLoading here since filters are loaded from localStorage
  // The assignments loading is handled separately

  return (
    <header className="bar-primary" role="banner">
      {/* Brand */}
      <div className="brand">CourseFlow</div>

      {/* Workspace view switcher */}
      <div className="view-switch" role="tablist" aria-label="Workspace view">
        <button
          type="button"
          role="tab"
          aria-selected={!isNotesView}
          className={`view-switch__btn ${isNotesView ? '' : 'active'}`}
          onClick={() => {
            void navigate('/');
          }}
        >
          Assignments
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isNotesView}
          className={`view-switch__btn ${isNotesView ? 'active' : ''}`}
          onClick={() => {
            void navigate('/notes');
          }}
        >
          Notes
        </button>
      </div>

      {/* Status Tabs */}
      {!isNotesView && (
      <>
      <div className="tabs" role="tablist" aria-label="Assignment status">
        <button
          className={`tab ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={handleTabChange}
          role="tab"
          aria-selected={statusFilter === 'all'}
          type="button"
        >
          All
        </button>
        <button
          className={`tab ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={handleTabChange}
          role="tab"
          aria-selected={statusFilter === 'pending'}
          type="button"
        >
          Pending
        </button>
        <button
          className={`tab ${statusFilter === 'completed' ? 'active' : ''}`}
          onClick={handleTabChange}
          role="tab"
          aria-selected={statusFilter === 'completed'}
          type="button"
        >
          Completed
        </button>
      </div>

      {/* Search */}
      <div className="search">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search assignments…"
          value={searchQuery || ''}
          onChange={handleSearch}
          className="search-input"
          aria-label="Search assignments"
        />
      </div>
      </>
      )}

      <div className="spacer" />

      {/* Sync Pill */}
      <SyncStatusIndicator onSync={handleSyncClick} compact={true} />

      {/* Settings Button */}
      <button
        className="icon-btn"
        onClick={handleOpenSettings}
        aria-label="Open settings"
        type="button"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </header>
  );
}
