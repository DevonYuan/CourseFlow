/**
 * PageActions — Context Menu for Page Tree Nodes
 *
 * Provides actions for creating child/sibling pages, renaming,
 * duplicating, and deleting pages. Appears on right-click or
 * via keyboard shortcut (Context Menu key / Shift+F10).
 *
 * @module @frontend/components/notes/PageActions
 */

import type { Page } from '@backend/shared/types';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

import './PageActions.css';

interface PageActionsProps {
  /** The page these actions apply to */
  page: Page;
  /** Callback to create a new child page */
  onCreateChild: () => void;
  /** Callback to create a new sibling page */
  onCreateSibling: () => void;
  /** Callback to start rename */
  onRename: () => void;
  /** Callback to duplicate page */
  onDuplicate: () => void;
  /** Callback to delete page */
  onDelete: () => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

export function PageActions({
  page,
  onCreateChild,
  onCreateSibling,
  onRename,
  onDuplicate,
  onDelete,
}: PageActionsProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ x: 0, y: 0 });

  // Close menu on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Focus first menu item
      setTimeout(() => {
        const firstItem = menuRef.current?.querySelector('[role="menuitem"]') as HTMLElement;
        firstItem?.focus();
      }, 0);
    }
  }, [isOpen]);

  const openMenu = useCallback(
    (event: React.MouseEvent | React.KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if ('clientX' in event) {
        // Pointer/mouse event — position the menu at the cursor.
        setPosition({ x: event.clientX, y: event.clientY });
      } else if (triggerRef.current) {
        // Keyboard event — position the menu under the trigger button.
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({ x: rect.left, y: rect.bottom });
      }

      setIsOpen(true);
    },
    [],
  );

  const handleCreateChild = useCallback(() => {
    onCreateChild();
    setIsOpen(false);
  }, [onCreateChild]);

  const handleCreateSibling = useCallback(() => {
    onCreateSibling();
    setIsOpen(false);
  }, [onCreateSibling]);

  const handleRename = useCallback(() => {
    onRename();
    setIsOpen(false);
  }, [onRename]);

  const handleDuplicate = useCallback(() => {
    onDuplicate();
    setIsOpen(false);
  }, [onDuplicate]);

  const handleDelete = useCallback(() => {
    onDelete();
    setIsOpen(false);
  }, [onDelete]);

  // Render menu as portal to body for proper positioning
  const menuContent = (
    <div
      ref={menuRef}
      className="page-actions-menu"
      role="menu"
      aria-label={`Actions for ${page.title}`}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button type="button" className="page-actions-menu__item" role="menuitem" onClick={handleCreateChild}>
        <span className="page-actions-menu__icon">➕</span>
        <span>New Child Page</span>
        <kbd className="page-actions-menu__shortcut">Ctrl+N</kbd>
      </button>
      <button type="button" className="page-actions-menu__item" role="menuitem" onClick={handleCreateSibling}>
        <span className="page-actions-menu__icon">➕</span>
        <span>New Sibling Page</span>
        <kbd className="page-actions-menu__shortcut">Ctrl+Shift+N</kbd>
      </button>
      <hr className="page-actions-menu__separator" />
      <button type="button" className="page-actions-menu__item" role="menuitem" onClick={handleRename}>
        <span className="page-actions-menu__icon">✏️</span>
        <span>Rename</span>
        <kbd className="page-actions-menu__shortcut">F2</kbd>
      </button>
      <button type="button" className="page-actions-menu__item" role="menuitem" onClick={handleDuplicate}>
        <span className="page-actions-menu__icon">📋</span>
        <span>Duplicate</span>
        <kbd className="page-actions-menu__shortcut">Ctrl+D</kbd>
      </button>
      <hr className="page-actions-menu__separator" />
      <button
        type="button"
        className="page-actions-menu__item page-actions-menu__item--destructive"
        role="menuitem"
        onClick={handleDelete}
      >
        <span className="page-actions-menu__icon">🗑️</span>
        <span>Delete</span>
        <kbd className="page-actions-menu__shortcut">Delete</kbd>
      </button>
    </div>
  );

  // Trigger button (hidden, shown on hover/focus of parent)
  const trigger = (
    <button
      ref={triggerRef}
      className="page-actions-trigger"
      onClick={openMenu}
      onContextMenu={openMenu}
      onKeyDown={(e) => {
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          openMenu(e);
        }
      }}
      aria-label={`Actions for ${page.title}`}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      type="button"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="2.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="7" cy="11.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );

  return (
    <>
      {trigger}
      {isOpen && createPortal(menuContent, document.body)}
    </>
  );
}