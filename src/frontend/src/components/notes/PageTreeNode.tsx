/**
 * PageTreeNode — Single Node in the Notes Sidebar Tree
 *
 * Renders a single row: drag handle, expand/collapse chevron, icon, title
 * (with inline rename), and a context-menu trigger. Owns keyboard navigation
 * for the row. The page tree is rendered as a flattened, depth-indented list
 * so a single SortableContext spans every level.
 *
 * @module @frontend/components/notes/PageTreeNode
 */

import type { EntityId, PageTreeNode } from '@backend/shared/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { usePageActions } from '../../hooks/usePageActions';
import {
  useNotesStore,
  selectDragState,
  selectActivePageId,
  selectPageMap,
} from '../../stores/notesStore';
import type { TreeNavDirection } from '../../utils/dnd';
import { ConfirmModal } from '../ui/ConfirmModal';

import { PageActions } from './PageActions';
import { FolderIcon, PageIcon } from './icons';
import './PageTreeNode.css';

interface PageTreeNodeProps {
  /** The page tree node to render */
  node: PageTreeNode;
  /** Current depth in the tree (for indentation) */
  depth: number;
  /** 1-based position of this node among its siblings (ARIA posinset) */
  posInSet: number;
  /** Number of siblings at this level (ARIA setsize) */
  setSize: number;
  /** Currently focused page id (for keyboard-nav highlight) */
  focusedId: EntityId | null;
  /** Callback when focus changes */
  onFocusChange: (nodeId: EntityId | null) => void;
  /** Callback when a page is selected (navigate to editor) */
  onSelect: (pageId: EntityId) => void;
  /** Callback for keyboard navigation */
  onNavigate: (direction: TreeNavDirection) => void;
  /** Callback to register this node's DOM rect for DnD drop math */
  onMeasure: (id: EntityId, rect: DOMRect | null) => void;
}

export function PageTreeNode({
  node,
  depth,
  posInSet,
  setSize,
  focusedId,
  onFocusChange,
  onSelect,
  onNavigate,
  onMeasure,
}: PageTreeNodeProps): JSX.Element {
  const { page, children } = node;

  const toggleExpanded = useNotesStore((s) => s.toggleExpanded);
  const startRename = useNotesStore((s) => s.startRename);
  const commitRename = useNotesStore((s) => s.commitRename);
  const expanded = useNotesStore((s) => s.expanded);
  const { createPage, updatePage, deletePage, duplicatePage } = usePageActions();

  const dragState = useNotesStore(selectDragState);
  const activePageId = useNotesStore(selectActivePageId);
  const isFocused = focusedId === page.id;

  const inputRef = useRef<HTMLInputElement>(null);
  const [editValue, setEditValue] = useState(page.title);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isExpanded = expanded.has(page.id);
  const renamingId = useNotesStore((s) => s.renameState.renamingId);
  const cancelRename = useNotesStore((s) => s.cancelRename);
  const pageMap = useNotesStore(selectPageMap);
  const isEditing = renamingId === page.id;

  // When this row enters rename mode, seed and focus the inline input.
  useEffect(() => {
    if (!isEditing) return;
    setEditValue(page.title);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [isEditing, page.title]);

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: page.id,
    data: { depth },
  });

  // Combine the DnD node ref with rect registration for drop-position math.
  const combinedRef = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      onMeasure(page.id, el ? el.getBoundingClientRect() : null);
    },
    [setNodeRef, onMeasure, page.id],
  );

  const handleToggleExpand = useCallback(() => {
    toggleExpanded(page.id);
  }, [toggleExpanded, page.id]);

  const handleRenameStart = useCallback(() => {
    startRename(page.id, page.title);
  }, [startRename, page.id, page.title]);

  const handleRenameCommit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== page.title) {
      void updatePage({ id: page.id, title: trimmed });
    }
    commitRename();
  }, [commitRename, editValue, page.id, page.title, updatePage]);

  const handleRenameCancel = useCallback(() => {
    setEditValue(page.title);
    cancelRename();
  }, [cancelRename, page.title]);

  const handleDelete = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    setConfirmOpen(false);
    // Focus the next sibling, then the previous sibling, then the parent.
    const parentId = pageMap[page.id]?.parentId ?? null;
    const siblings =
      parentId === null
        ? Object.values(pageMap)
            .filter((n) => n.parentId === null)
            .sort((a, b) => a.page.position - b.page.position)
            .map((n) => n.page.id)
        : (pageMap[parentId]?.children ?? []);
    const idx = siblings.indexOf(page.id);
    const fallbackId = siblings[idx + 1] ?? siblings[idx - 1] ?? parentId ?? null;

    void deletePage(page.id).then(() => {
      if (fallbackId) {
        onFocusChange(fallbackId);
        onSelect(fallbackId);
      } else {
        onFocusChange(null);
      }
    });
  }, [page.id, pageMap, deletePage, onFocusChange, onSelect]);

  const handleDuplicate = useCallback(() => {
    void duplicatePage(page.id).then((result) => {
      if (result.ok) {
        onSelect(result.data.id);
      }
    });
  }, [duplicatePage, page.id, onSelect]);

  const handleNewChild = useCallback(() => {
    void createPage({
      parentId: page.id,
      title: 'New Page',
    }).then((result) => {
      if (result.ok) {
        onSelect(result.data.id);
        startRename(result.data.id, 'New Page');
      }
    });
  }, [createPage, page.id, onSelect, startRename]);

  const handleNewSibling = useCallback(() => {
    void createPage({
      parentId: page.parentId ?? null,
      title: 'New Page',
    }).then((result) => {
      if (result.ok) {
        onSelect(result.data.id);
        startRename(result.data.id, 'New Page');
      }
    });
  }, [createPage, page.parentId, onSelect, startRename]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (isEditing) {
        switch (event.key) {
          case 'Enter': {
            event.preventDefault();
            handleRenameCommit();
            break;
          }
          case 'Escape': {
            event.preventDefault();
            handleRenameCancel();
            break;
          }
          default: {
            break;
          }
        }
        return;
      }

      const withModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (withModifier && key === 'd') {
        event.preventDefault();
        handleDuplicate();
        return;
      }
      if (withModifier && key === 'n') {
        event.preventDefault();
        if (event.shiftKey) {
          handleNewSibling();
        } else {
          handleNewChild();
        }
        return;
      }

      switch (event.key) {
        case 'ArrowUp': {
          event.preventDefault();
          onNavigate('up');
          break;
        }
        case 'ArrowDown': {
          event.preventDefault();
          onNavigate('down');
          break;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          if (isExpanded) {
            handleToggleExpand();
          } else {
            onNavigate('left');
          }
          break;
        }
        case 'ArrowRight': {
          event.preventDefault();
          if (children.length > 0 && !isExpanded) {
            handleToggleExpand();
          } else if (children.length > 0) {
            onNavigate('right');
          }
          break;
        }
        case 'Enter': {
          event.preventDefault();
          onSelect(page.id);
          break;
        }
        case 'F2': {
          event.preventDefault();
          handleRenameStart();
          break;
        }
        case 'Delete': {
          event.preventDefault();
          handleDelete();
          break;
        }
        default: {
          break;
        }
      }
    },
    [
      isEditing,
      isExpanded,
      children.length,
      handleToggleExpand,
      onNavigate,
      onSelect,
      page.id,
      handleRenameStart,
      handleRenameCommit,
      handleRenameCancel,
      handleDelete,
      handleDuplicate,
      handleNewChild,
      handleNewSibling,
    ],
  );

  const hasChildren = children.length > 0;
  const isActive = activePageId === page.id;
  const isDragTarget = dragState.dropTargetId === page.id;
  const isDragInside = isDragTarget && dragState.dropPosition === 'inside';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    '--tree-node-depth': depth,
  } as React.CSSProperties;

  return (
    <>
    <div
      ref={combinedRef}
      data-page-id={page.id}
      className={[
        'page-tree-node',
        isFocused ? 'focused' : '',
        isActive ? 'active' : '',
        isDragTarget ? 'drop-target' : '',
        isDragInside ? 'drop-inside' : '',
        depth > 0 ? 'page-tree-node--nested' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-level={depth + 1}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isActive}
      role="treeitem"
      tabIndex={isFocused ? 0 : -1}
      onKeyDown={handleKeyDown}
      onFocus={() => onFocusChange(page.id)}
      onBlur={() => onFocusChange(null)}
      title={hasChildren ? 'Drag to reorder or nest' : 'Drag to reorder'}
    >
      {/* Drag Handle */}
      <div
        className="page-tree-node__drag-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M4 4h8M4 8h8M4 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Expand/Collapse Chevron */}
      {hasChildren && (
        <button
          type="button"
          className={`page-tree-node__chevron ${isExpanded ? 'expanded' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleExpand();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggleExpand();
            }
          }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          aria-expanded={isExpanded}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* Page Content */}
      <div
        className="page-tree-node__content"
        onClick={() => {
          if (!isEditing) onSelect(page.id);
        }}
        onDoubleClick={() => {
          if (!isEditing) handleRenameStart();
        }}
      >
        <span className="page-tree-node__icon" aria-hidden="true">
          {hasChildren ? <FolderIcon size={14} /> : <PageIcon size={14} />}
        </span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="page-tree-node__input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameCommit}
            autoFocus
            aria-label="Page title"
          />
        ) : (
          <span className="page-tree-node__title">{page.title || 'Untitled'}</span>
        )}
      </div>

      {/* Context Menu / Actions */}
      <PageActions
        page={page}
        onCreateChild={handleNewChild}
        onCreateSibling={handleNewSibling}
        onRename={handleRenameStart}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Delete page"
        message={`Delete "${page.title}" and all of its sub-pages? This cannot be undone.`}
        confirmText="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}