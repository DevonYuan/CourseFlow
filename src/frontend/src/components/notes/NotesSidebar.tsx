/**
 * NotesSidebar — Main Sidebar Component for Notes Workspace
 *
 * Renders the collapsible sidebar with page tree, header with
 * create page button, and handles keyboard navigation focus management.
 *
 * @module @frontend/components/notes/NotesSidebar
 */

import type { EntityId } from '@backend/shared/types';
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useToast } from '../../context/ToastContext';
import { usePageActions } from '../../hooks/usePageActions';
import { useNotesStore, selectActivePageId } from '../../stores/notesStore';

import { PageTree } from './PageTree';
import './NotesSidebar.css';

interface NotesSidebarProps {
  /** Current page ID from route (for highlighting active page) */
  currentPageId?: EntityId | null;
  /** Callback when sidebar collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
}

export function NotesSidebar({ currentPageId, onCollapseChange }: NotesSidebarProps): JSX.Element {
  const navigate = useNavigate();
  const { createPage } = usePageActions();
  const { error: showErrorToast } = useToast();
  const activePageId = useNotesStore(selectActivePageId);
  const startRename = useNotesStore((s) => s.startRename);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Handle page selection (navigate to editor)
  const handleSelect = useCallback(
    (pageId: EntityId) => {
      void navigate(`/notes/${pageId}`);
    },
    [navigate],
  );

  // Handle new root page creation
  const handleNewRootPage = useCallback(() => {
    void createPage({ parentId: null, title: 'New Page' }).then((result) => {
      if (result.ok) {
        void navigate(`/notes/${result.data.id}`);
        startRename(result.data.id, 'New Page');
      } else {
        showErrorToast('Failed to create page');
      }
    });
  }, [createPage, navigate, startRename, showErrorToast]);

  // Handle collapse toggle
  const handleToggleCollapse = useCallback(() => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapseChange?.(next);
  }, [isCollapsed, onCollapseChange]);

  return (
    <aside
      className={`notes-sidebar ${isCollapsed ? 'collapsed' : ''}`}
      role="complementary"
      aria-label="Notes sidebar"
      data-collapsed={isCollapsed}
    >
      {/* Sidebar Header */}
      <header className="notes-sidebar__header">
        <div className="notes-sidebar__title-group">
          <h2 className="notes-sidebar__title">Notes</h2>
          {isCollapsed && (
            <span className="notes-sidebar__title-tooltip">Notes</span>
          )}
        </div>

        <div className="notes-sidebar__actions">
          <button
            className="notes-sidebar__btn notes-sidebar__btn--primary"
            onClick={handleNewRootPage}
            aria-label="Create new page"
            type="button"
            title="New Page (Ctrl+N)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 2V14M2 8H14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="notes-sidebar__btn-text">New Page</span>
          </button>

          <button
            className="notes-sidebar__btn notes-sidebar__btn--collapse"
            onClick={handleToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className={isCollapsed ? 'rotated' : ''}
            >
              <path
                d="M10 4L6 8L10 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Divider */}
      <div className="notes-sidebar__divider" role="separator" />

      {/* Page Tree */}
      {!isCollapsed && (
        <div className="notes-sidebar__tree-wrapper">
          <PageTree
            onSelect={handleSelect}
            initialFocusId={currentPageId ?? activePageId}
          />
        </div>
      )}

      {/* Footer - Keyboard Shortcuts Hint */}
      {!isCollapsed && (
        <footer className="notes-sidebar__footer">
          <div className="notes-sidebar__shortcuts">
            <kbd className="notes-sidebar__kbd">↑↓</kbd> Navigate
            <kbd className="notes-sidebar__kbd">←→</kbd> Collapse/Expand
            <kbd className="notes-sidebar__kbd">Enter</kbd> Open
            <kbd className="notes-sidebar__kbd">F2</kbd> Rename
            <kbd className="notes-sidebar__kbd">Del</kbd> Delete
          </div>
        </footer>
      )}
    </aside>
  );
}