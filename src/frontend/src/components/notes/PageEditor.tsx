/**
 * NotesEditor — Markdown Editor for Page Content
 *
 * Split-view markdown editor with live preview, toolbar, and auto-save.
 * MVP implementation using textarea + preview; future: block-based editor (TipTap/Slate).
 *
 * @module @frontend/components/notes/PageEditor
 */

import type { EntityId, Page } from '@backend/shared/types';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useToast } from '../../context/ToastContext';
import { usePageActions } from '../../hooks/usePageActions';

import { LinkIcon, PageIcon } from './icons';
import './PageEditor.css';

interface PageEditorProps {
  /** Page data passed from parent route */
  page?: Page | null;
}

export function PageEditor({ page: initialPage }: PageEditorProps): JSX.Element {
  const { pageId } = useParams<{ pageId?: string }>();
  const navigate = useNavigate();
  const { getPage, updatePage } = usePageActions();
  const { error: showErrorToast } = useToast();

  const [page, setPage] = useState<Page | null>(initialPage ?? null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedContentRef = useRef('');

  const loadPage = useCallback(
    async (id: EntityId) => {
      const result = await getPage(id);
      if (result.ok && result.data) {
        setPage(result.data);
        setContent(result.data.content ?? '');
        lastSavedContentRef.current = result.data.content ?? '';
      } else if (!result.ok) {
        showErrorToast('Failed to load page');
        void navigate('/notes');
      }
    },
    [getPage, showErrorToast, navigate],
  );

  // Load page data when pageId changes
  useEffect(() => {
    if (pageId && (!page || page.id !== pageId)) {
      void loadPage(pageId as EntityId);
    }
  }, [pageId, page, loadPage]);

  const saveContent = useCallback(
    async (value: string) => {
      if (!page) return;

      setIsSaving(true);
      const result = await updatePage({ id: page.id, content: value });
      setIsSaving(false);

      if (result.ok) {
        lastSavedContentRef.current = value;
        setPage(result.data);
      } else {
        setSaveError(result.error || 'Failed to save');
        showErrorToast('Failed to save page');
      }
    },
    [page, updatePage, showErrorToast],
  );

  // Auto-save on content change (debounced)
  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      setSaveError(null);

      // Update counts
      const words = value.trim() ? value.trim().split(/\s+/).length : 0;
      setWordCount(words);
      setCharCount(value.length);

      // Debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (page && value !== lastSavedContentRef.current) {
          void saveContent(value);
        }
      }, 1000);
    },
    [page, saveContent],
  );

  // Force save on blur or before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (page && content !== lastSavedContentRef.current) {
        void saveContent(content);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [page, content, saveContent]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (page && content !== lastSavedContentRef.current) {
          void saveContent(content);
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        wrapSelection('**', '**');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
        event.preventDefault();
        wrapSelection('*', '*');
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '`') {
        event.preventDefault();
        wrapSelection('`', '`');
      }
    };

    const wrapSelection = (prefix: string, suffix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.slice(start, end);
      const newText = content.slice(0, start) + prefix + selectedText + suffix + content.slice(end);

      setContent(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
      }, 0);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [content, page, saveContent]);

  // Render markdown to HTML (simple implementation)
  const renderMarkdown = useCallback((md: string): string => {
    if (!md) return '';

    // Simple markdown rendering for MVP
    return md
      .replaceAll('&', '&')
      .replaceAll('<', '<')
      .replaceAll('>', '>')
      .replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replaceAll(/\*(.+?)\*/g, '<em>$1</em>')
      .replaceAll(/`(.+?)`/g, '<code>$1</code>')
      .replaceAll(/^### (.*$)/gm, '<h3>$1</h3>')
      .replaceAll(/^## (.*$)/gm, '<h2>$1</h2>')
      .replaceAll(/^# (.*$)/gm, '<h1>$1</h1>')
      .replaceAll(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replaceAll('\n', '<br>');
  }, []);

  const previewHtml = renderMarkdown(content);

  // Toolbar actions
  const handleBold = () => wrapSelection('**', '**');
  const handleItalic = () => wrapSelection('*', '*');
  const handleCode = () => wrapSelection('`', '`');
  const handleHeading = (level: number) => {
    const prefix = '#'.repeat(level) + ' ';
    wrapSelection(prefix, '');
  };
  const handleList = () => wrapSelection('- ', '');
  const handleLink = () => wrapSelection('[', '](url)');

  const wrapSelection = (prefix: string, suffix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);
    const newText = content.slice(0, start) + prefix + selectedText + suffix + content.slice(end);

    handleContentChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  if (!page) {
    return (
      <div className="page-editor page-editor--loading" role="status" aria-label="Loading page">
        <div className="page-editor__spinner" aria-hidden="true" />
      </div>
    );
  }

  return (
    <article className="page-editor" role="region" aria-label={`Editing: ${page.title}`}>
      {/* Editor Header */}
      <header className="page-editor__header">
        <div className="page-editor__title-group">
          <input
            type="text"
            className="page-editor__title-input"
            value={page.title}
            onChange={(e) => {
              const newTitle = e.target.value;
              if (newTitle !== page.title) {
                void updatePage({ id: page.id, title: newTitle });
                setPage({ ...page, title: newTitle });
              }
            }}
            onBlur={() => {
              if (page.title.trim() === '') {
                void updatePage({ id: page.id, title: 'Untitled' });
                setPage({ ...page, title: 'Untitled' });
              }
            }}
            placeholder="Untitled"
            aria-label="Page title"
          />
          <span className="page-editor__icon" aria-hidden="true"><PageIcon size={20} /></span>
        </div>

        <div className="page-editor__status">
          {isSaving && <span className="page-editor__saving" aria-live="polite">Saving…</span>}
          {!isSaving && content !== lastSavedContentRef.current && (
            <span className="page-editor__unsaved" aria-live="polite">Unsaved</span>
          )}
          {!isSaving && content === lastSavedContentRef.current && content && (
            <span className="page-editor__saved" aria-live="polite">Saved</span>
          )}
          {saveError && <span className="page-editor__error" aria-live="assertive">{saveError}</span>}
        </div>
      </header>

      {/* Toolbar */}
      <div className="page-editor__toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" className="page-editor__tool-btn" onClick={() => handleHeading(1)} title="Heading 1 (Ctrl+Alt+1)" aria-label="Heading 1">H1</button>
        <button type="button" className="page-editor__tool-btn" onClick={() => handleHeading(2)} title="Heading 2 (Ctrl+Alt+2)" aria-label="Heading 2">H2</button>
        <button type="button" className="page-editor__tool-btn" onClick={() => handleHeading(3)} title="Heading 3 (Ctrl+Alt+3)" aria-label="Heading 3">H3</button>
        <div className="page-editor__toolbar-divider" role="separator" />
        <button type="button" className="page-editor__tool-btn" onClick={handleBold} title="Bold (Ctrl+B)" aria-label="Bold"><strong>B</strong></button>
        <button type="button" className="page-editor__tool-btn" onClick={handleItalic} title="Italic (Ctrl+I)" aria-label="Italic"><em>I</em></button>
        <button type="button" className="page-editor__tool-btn" onClick={handleCode} title="Inline Code (Ctrl+`)" aria-label="Inline Code"><code>{'` '}</code></button>
        <div className="page-editor__toolbar-divider" role="separator" />
        <button type="button" className="page-editor__tool-btn" onClick={handleList} title="Bullet List" aria-label="Bullet List">• List</button>
        <button type="button" className="page-editor__tool-btn" onClick={handleLink} title="Insert Link" aria-label="Insert Link"><LinkIcon size={14} /> Link</button>
      </div>

      {/* Editor/Preview Split */}
      <div className="page-editor__split">
        {/* Editor Pane */}
        <div className="page-editor__pane page-editor__pane--editor">
          <label htmlFor="editor-content" className="visually-hidden">Markdown content</label>
          <textarea
            ref={textareaRef}
            id="editor-content"
            className="page-editor__textarea"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={(e) => {
              // Tab key support
              if (e.key === 'Tab') {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                const newContent = content.slice(0, start) + '  ' + content.slice(end);
                handleContentChange(newContent);
                setTimeout(() => {
                  e.currentTarget.setSelectionRange(start + 2, start + 2);
                }, 0);
              }
            }}
            placeholder="Start writing… (Markdown supported)"
            spellCheck={true}
            aria-label="Markdown editor"
          />
        </div>

        {/* Preview Pane */}
        <div className="page-editor__pane page-editor__pane--preview">
          <div
            ref={previewRef}
            className="page-editor__preview"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            aria-label="Markdown preview"
          />
        </div>
      </div>

      {/* Footer - Stats */}
      <footer className="page-editor__footer">
        <div className="page-editor__stats">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
        <div className="page-editor__hints">
          <kbd>Ctrl+B</kbd> Bold
          <kbd>Ctrl+I</kbd> Italic
          <kbd>Ctrl+`</kbd> Code
          <kbd>Ctrl+S</kbd> Save
        </div>
      </footer>
    </article>
  );
}