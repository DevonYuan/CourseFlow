/**
 * NotesWorkspace — Top-Level Page for Notes Workspace
 *
 * Renders the sidebar + editor split view layout for the Notes workspace.
 * The /notes and /notes/:pageId routes are defined in App.tsx.
 *
 * @module @frontend/pages/NotesWorkspace
 */

import type { EntityId } from '@backend/shared/types';
import React, { useCallback, useRef, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';

import { NotesSidebar } from '../components/notes/NotesSidebar';
import { usePageActions } from '../hooks/usePageActions';
import { useNotesStore } from '../stores/notesStore';
import './NotesWorkspace.css';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const DEFAULT_SIDEBAR_WIDTH = 280;

export function NotesWorkspace(): JSX.Element {
  const { pageId } = useParams<{ pageId?: string }>();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeStateRef.current = { startX: event.clientX, startWidth: sidebarWidth };

      const onMove = (moveEvent: PointerEvent) => {
        const state = resizeStateRef.current;
        if (!state) return;
        const next = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, state.startWidth + (moveEvent.clientX - state.startX)),
        );
        setSidebarWidth(next);
      };
      const onUp = () => {
        resizeStateRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [sidebarWidth],
  );

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -10 : 10;
    setSidebarWidth((width) =>
      Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width + delta)),
    );
  }, []);

  return (
    <div
      className="notes-workspace"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <NotesSidebar currentPageId={pageId ? (pageId as EntityId) : null} />

      {/* Resize handle sits between the sidebar and the editor. */}
      <div
        className="notes-workspace__resize-handle"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onPointerDown={handleResizeStart}
        onKeyDown={handleResizeKeyDown}
      />

      <div className="notes-workspace__main">
        <div className="notes-workspace__editor">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/**
 * NotesWelcome — Welcome/Empty State for Notes Workspace
 *
 * Shown when navigating to /notes without a specific page selected.
 */
export function NotesWelcome(): JSX.Element {
  const navigate = useNavigate();
  const { createPage } = usePageActions();
  const startRename = useNotesStore((s) => s.startRename);

  const handleCreate = useCallback(
    (icon: string, title: string) => {
      void createPage({ parentId: null, title, icon }).then((result) => {
        if (result.ok) {
          void navigate(`/notes/${result.data.id}`);
          startRename(result.data.id, title);
        }
      });
    },
    [createPage, navigate, startRename],
  );

  return (
    <div className="notes-welcome">
      <div className="notes-welcome__content">
        <div className="notes-welcome__icon" aria-hidden="true">📝</div>
        <h1 className="notes-welcome__title">Welcome to Notes</h1>
        <p className="notes-welcome__description">
          Create pages, organize them into a hierarchy, and build your personal knowledge base.
          All notes are stored locally and never leave your device.
        </p>
        <div className="notes-welcome__actions">
          <button
            className="notes-welcome__btn notes-welcome__btn--primary"
            type="button"
            onClick={() => handleCreate('📄', 'New Page')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M9 2V16M2 9H16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Create your first page
          </button>
          <button
            className="notes-welcome__btn notes-welcome__btn--secondary"
            type="button"
            onClick={() => handleCreate('📁', 'New Folder')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M12 3L6 9L12 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Create a folder
          </button>
        </div>
        <div className="notes-welcome__features">
          <div className="notes-welcome__feature">
            <span className="notes-welcome__feature-icon" aria-hidden="true">📁</span>
            <span>Nested pages & folders</span>
          </div>
          <div className="notes-welcome__feature">
            <span className="notes-welcome__feature-icon" aria-hidden="true">✍️</span>
            <span>Markdown editing</span>
          </div>
          <div className="notes-welcome__feature">
            <span className="notes-welcome__feature-icon" aria-hidden="true">🔍</span>
            <span>Full-text search</span>
          </div>
          <div className="notes-welcome__feature">
            <span className="notes-welcome__feature-icon" aria-hidden="true">🔗</span>
            <span>Wiki-style links</span>
          </div>
        </div>
      </div>
    </div>
  );
}