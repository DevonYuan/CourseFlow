/**
 * AllCompletePrompt — All Sub-tasks Complete Prompt
 *
 * Shows an inline banner when all sub-tasks are complete and the
 * assignment is still pending. Provides "Mark Complete" and "Dismiss" actions.
 * Dismissal state persisted in localStorage per assignment.
 *
 * @module @frontend/components/subtasks/AllCompletePrompt
 */

import React, { useCallback, useEffect } from 'react';
import type { EntityId } from '@backend/shared/types';

import {
  isPromptDismissed,
  setPromptDismissed,
  clearPromptDismissed,
} from '../../utils/localStorage';

import './AllCompletePrompt.css';

interface AllCompletePromptProps {
  /** Assignment ID for dismissal persistence */
  assignmentId: EntityId;
  /** Callback when "Mark Complete" is clicked */
  onMarkComplete: () => Promise<void>;
  /** Whether the prompt is currently dismissed */
  dismissed: boolean;
  /** Callback when dismissed state changes */
  onDismissChange: (dismissed: boolean) => void;
}

/**
 * AllCompletePrompt - Inline banner prompting user to mark assignment complete
 * when all sub-tasks are done.
 */
export function AllCompletePrompt({
  assignmentId,
  onMarkComplete,
  dismissed,
  onDismissChange,
}: AllCompletePromptProps): JSX.Element | null {
  // Don't render if dismissed
  if (dismissed) {
    return null;
  }

  const handleMarkComplete = useCallback(async () => {
    await onMarkComplete();
    // The assignment status change will cause a re-render
    // and the prompt will naturally disappear since status !== 'pending'
  }, [onMarkComplete]);

  const handleDismiss = useCallback(() => {
    setPromptDismissed(assignmentId, true);
    onDismissChange(true);
  }, [assignmentId, onDismissChange]);

  // Handle Escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  return (
    <div className="all-complete-prompt" role="status" aria-live="polite" aria-atomic="true">
      <div className="all-complete-prompt__content">
        <svg
          className="all-complete-prompt__icon"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <span className="all-complete-prompt__message">
          All sub-tasks done — mark assignment complete?
        </span>
      </div>
      <div className="all-complete-prompt__actions">
        <button
          type="button"
          className="all-complete-prompt__btn all-complete-prompt__btn--primary"
          onClick={handleMarkComplete}
        >
          Mark Complete
        </button>
        <button
          type="button"
          className="all-complete-prompt__btn all-complete-prompt__btn--dismiss"
          onClick={handleDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
