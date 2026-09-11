/**
 * NotesEditor — Note Editor Component
 *
 * Textarea with auto-resize, character count, keyboard shortcuts
 * (Ctrl+Enter to save, Escape to cancel), and saving indicator.
 *
 * @module @frontend/components/notes/NotesEditor
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';

import './Notes.css';

const MAX_CHARS = 10_000;
const WARN_CHARS = 8000;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 300;

export interface NotesEditorProps {
  /** Initial content (for editing existing note) */
  initialContent?: string;
  /** Callback when save is triggered (Ctrl+Enter or Save button) */
  onSave: (content: string) => void;
  /** Callback when cancel is triggered (Escape or Cancel button) */
  onCancel: () => void;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Auto-focus the textarea on mount */
  autoFocus?: boolean;
}

/**
 * NotesEditor - Textarea editor for notes.
 * Features:
 * - Auto-resize textarea (grows with content, scrolls after max height)
 * - Character count with warning at threshold
 * - Ctrl+Enter to save, Escape to cancel
 * - Saving indicator
 * - Accessible: proper labels, focus management
 */
export function NotesEditor({
  initialContent = '',
  onSave,
  onCancel,
  isSaving = false,
  placeholder = 'Add a note about this assignment...',
  autoFocus = true,
}: NotesEditorProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(initialContent);
  const [height, setHeight] = useState(MIN_HEIGHT);

  // Sync content with initialContent prop (for editing existing notes)
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get correct scrollHeight
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    setHeight(newHeight);
    textarea.style.height = `${newHeight}px`;

    // Show scrollbar if content exceeds max height
    textarea.style.overflowY = newHeight >= MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  // Adjust height when content changes
  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [autoFocus]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter (or Meta+Enter on Mac) to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const trimmed = content.trim();
        if (trimmed) {
          onSave(trimmed);
        }
        return;
      }

      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      // Tab handling - allow tab for indentation, Shift+Tab moves focus
      if (e.key === 'Tab' && !e.shiftKey) {
        // Allow tab character in textarea
        e.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newContent = content.slice(0, start) + '  ' + content.slice(end);
          setContent(newContent);
          // Move cursor after inserted spaces
          setTimeout(() => {
            textarea.setSelectionRange(start + 2, start + 2);
          }, 0);
        }
      }
    },
    [content, onSave, onCancel],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }, []);

  const handleSaveClick = useCallback(() => {
    const trimmed = content.trim();
    if (trimmed && !isSaving) {
      onSave(trimmed);
    }
  }, [content, isSaving, onSave]);

  const handleCancelClick = useCallback(() => {
    if (!isSaving) {
      onCancel();
    }
  }, [isSaving, onCancel]);

  const charCount = content.length;
  const isOverWarn = charCount > WARN_CHARS;
  const isOverMax = charCount > MAX_CHARS;

  return (
    <div className="notes-editor">
      <textarea
        ref={textareaRef}
        className="notes-editor__textarea"
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isSaving}
        aria-label="Note content"
        aria-describedby="notes-editor-char-count"
        aria-multiline="true"
        rows={4}
        style={{ height: `${height}px` }}
        maxLength={MAX_CHARS}
      />

      <div className="notes-editor__footer">
        <span
          id="notes-editor-char-count"
          className={`notes-editor__char-count${isOverWarn ? ' notes-editor__char-count--warn' : ''}${isOverMax ? ' notes-editor__char-count--error' : ''}`}
          aria-live="polite"
        >
          {charCount} / {MAX_CHARS} characters
        </span>
        <div className="notes-editor__actions">
          {isSaving && (
            <span className="notes-editor__saving" aria-live="polite">
              Saving…
            </span>
          )}
          <button
            type="button"
            className="notes-editor__btn notes-editor__btn--cancel"
            onClick={handleCancelClick}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="notes-editor__btn notes-editor__btn--save"
            onClick={handleSaveClick}
            disabled={isSaving || content.trim() === '' || isOverMax}
          >
            Save (Ctrl+Enter)
          </button>
        </div>
      </div>
    </div>
  );
}
