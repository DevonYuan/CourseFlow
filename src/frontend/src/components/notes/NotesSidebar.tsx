/**
 * NotesSidebar — Main Sidebar Component for Notes Workspace
 *
 * Renders the page tree with header actions (new page, new subfolder, search)
 * and handles keyboard-navigation focus management.
 *
 * @module @frontend/components/notes/NotesSidebar
 */

import type { EntityId } from '@backend/shared/types';
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useToast } from '../../context/ToastContext';
import { usePageActions } from '../../hooks/usePageActions';
import { useNotesStore, selectActivePageId } from '../../stores/notesStore';
import { useSearchPaletteStore } from '../../stores/searchPaletteStore';

import { PageTree } from './PageTree';
import { FolderPlusIcon, SearchIcon } from './icons';
import './NotesSidebar.css';

interface NotesSidebarProps {
  /** Current page ID from route (for highlighting active page) */
  currentPageId?: EntityId | null;
}

export function NotesSidebar({ currentPageId }: NotesSidebarProps): JSX.Element {
  const navigate = useNavigate();
  const { createPage } = usePageActions();
  const { error: showErrorToast } = useToast();
  const activePageId = useNotesStore(selectActivePageId);
  const startRename = useNotesStore((s) => s.startRename);
  const openSearch = useSearchPaletteStore((s) => s.open);

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

  // Handle new subfolder creation — nested under the selected page when there
  // is one, otherwise created at the top level.
  const handleNewSubfolder = useCallback(() => {
    const parentId = currentPageId ?? activePageId ?? null;
    void createPage({ parentId, title: 'New Folder' }).then((result) => {
      if (result.ok) {
        // A nested folder is only visible once its parent is expanded.
        if (parentId) {
          const state = useNotesStore.getState();
          if (!state.expanded.has(parentId)) state.toggleExpanded(parentId);
        }
        void navigate(`/notes/${result.data.id}`);
        startRename(result.data.id, 'New Folder');
      } else {
        showErrorToast('Failed to create folder');
      }
    });
  }, [createPage, currentPageId, activePageId, navigate, startRename, showErrorToast]);

  return (
    <aside className="notes-sidebar" role="complementary" aria-label="Notes sidebar">
      {/* Sidebar Header */}
      <header className="notes-sidebar__header">
        <div className="notes-sidebar__title-group">
          <h2 className="notes-sidebar__title">Notes</h2>
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

          <span
            className="notes-sidebar__actions-divider"
            role="separator"
            aria-orientation="vertical"
          />

          <button
            className="notes-sidebar__btn notes-sidebar__btn--subfolder"
            onClick={handleNewSubfolder}
            aria-label="New subfolder"
            type="button"
            title="New subfolder"
          >
            <FolderPlusIcon size={15} />
            <span className="notes-sidebar__btn-text">New subfolder</span>
          </button>

          <button
            className="notes-sidebar__btn notes-sidebar__btn--search"
            onClick={openSearch}
            aria-label="Search pages (Cmd+K)"
            type="button"
            title="Search pages (Cmd+K)"
          >
            <SearchIcon size={15} />
            <span className="notes-sidebar__btn-text">Search</span>
          </button>
        </div>
      </header>

      {/* Divider */}
      <div className="notes-sidebar__divider" role="separator" />

      {/* Page Tree */}
      <div className="notes-sidebar__tree-wrapper">
        <PageTree
          onSelect={handleSelect}
          initialFocusId={currentPageId ?? activePageId}
        />
      </div>

      {/* Footer - Keyboard Shortcuts Hint */}
      <footer className="notes-sidebar__footer">
        <div className="notes-sidebar__shortcuts">
          <kbd className="notes-sidebar__kbd">↑↓</kbd> Navigate
          <kbd className="notes-sidebar__kbd">←→</kbd> Collapse/Expand
          <kbd className="notes-sidebar__kbd">Enter</kbd> Open
          <kbd className="notes-sidebar__kbd">F2</kbd> Rename
          <kbd className="notes-sidebar__kbd">Del</kbd> Delete
        </div>
      </footer>
    </aside>
  );
}