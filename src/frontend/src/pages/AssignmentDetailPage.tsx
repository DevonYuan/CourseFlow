/**
 * AssignmentDetailPage — Assignment Detail View Page
 *
 * Displays full assignment information including title, course, due date,
 * status, and Canvas description. Provides back navigation and handles
 * loading/error/not-found states. Includes sub-tasks and notes sections.
 *
 * @module @frontend/pages/AssignmentDetailPage
 */

import React, { useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AssignmentHeader } from '../components/assignments/AssignmentHeader';
import { NotesList } from '../components/notes/NotesList';
import { AllCompletePrompt } from '../components/subtasks/AllCompletePrompt';
import { SubTaskList } from '../components/subtasks/SubTaskList';
import { useAssignmentDetail } from '../hooks/useAssignmentDetail';
import { isPromptDismissed, setPromptDismissed } from '../utils/localStorage';

import './AssignmentDetailPage.css';

/**
 * Skeleton loader for the detail page while loading.
 */
function DetailSkeleton(): JSX.Element {
  return (
    <div className="assignment-detail__skeleton" role="status" aria-label="Loading assignment details">
      <div className="assignment-detail__header-skeleton">
        <div className="skeleton skeleton--back-button" />
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--meta" />
        <div className="skeleton skeleton--meta" />
      </div>
      <div className="assignment-detail__content-skeleton">
        <div className="skeleton skeleton--description-line" />
        <div className="skeleton skeleton--description-line" />
        <div className="skeleton skeleton--description-line short" />
        <div className="skeleton skeleton--description-line short" />
      </div>
    </div>
  );
}

/**
 * Not found state component.
 */
function NotFound({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="assignment-detail__not-found" role="alert">
      <div className="not-found__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h2 className="not-found__title">Assignment not found</h2>
      <p className="not-found__message">
        This assignment may have been deleted or the link is invalid.
      </p>
      <button className="not-found__back" onClick={onBack} type="button">
        ← Back to assignments
      </button>
    </div>
  );
}

/**
 * Error state component.
 */
function DetailError({ error, onRetry, onBack }: { error: string; onRetry: () => void; onBack: () => void }): JSX.Element {
  return (
    <div className="assignment-detail__error" role="alert">
      <div className="error-banner">
        <div className="error-banner__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="error-banner__content">
          <p className="error-banner__message">{error}</p>
          <div className="error-banner__actions">
            <button className="error-banner__retry" onClick={onRetry} type="button">
              Try again
            </button>
            <button className="error-banner__back" onClick={onBack} type="button">
              Back to list
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AssignmentDetailPage - Main detail view component.
 * Renders assignment header with title, course, due date, status,
 * sub-task progress, and the Canvas description content.
 */
export function AssignmentDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const assignmentId = id ?? '';
  const { assignment, subTasks, isLoading, error, notFound, refetch } = useAssignmentDetail(assignmentId);

  const subtasksSectionRef = useRef<HTMLDivElement>(null);

  const handleBack = () => {
    void navigate(-1);
  };

  const handleRetry = () => {
    void refetch();
  };

  const handleOpenInCanvas = () => {
    if (assignment?.htmlUrl) {
      window.open(assignment.htmlUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Scroll to sub-tasks section when progress bar is clicked
  const handleProgressClick = useCallback(() => {
    subtasksSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Handle "Mark Complete" from all-complete prompt
  const handleMarkComplete = useCallback(async () => {
    if (!assignment) return;
    try {
      await window.api.db.assignments.upsert({
        id: assignment.id,
        status: 'completed',
      });
      // Dismiss prompt after marking complete
      setPromptDismissed(assignment.id, true);
    } catch {
      // Error handling - toast will show from the store
    }
  }, [assignment]);

  // Check if prompt is dismissed
  const dismissed = assignment ? isPromptDismissed(assignment.id) : false;

  // Handle not found
  if (notFound) {
    return <NotFound onBack={handleBack} />;
  }

  // Handle error
  if (error) {
    return <DetailError error={error} onRetry={handleRetry} onBack={handleBack} />;
  }

  // Show skeleton while loading
  if (isLoading || !assignment) {
    return <DetailSkeleton />;
  }

  // Compute progress for all-complete prompt
  const completedCount = subTasks.filter((st) => st.completed).length;
  const totalCount = subTasks.length;
  const isAllComplete = totalCount > 0 && completedCount === totalCount;
  const showAllCompletePrompt = isAllComplete && assignment.status === 'pending' && !dismissed;

  return (
    <article className="assignment-detail" role="main" aria-label={assignment.title}>
      {/* Header Section */}
      <AssignmentHeader
        assignment={assignment}
        subTasks={subTasks}
        onBack={handleBack}
        onOpenInCanvas={handleOpenInCanvas}
        onProgressClick={handleProgressClick}
      />

      {/* Content Section */}
      <div className="assignment-detail__content">
        {/* All-complete prompt (shows when all sub-tasks done and assignment pending) */}
        {showAllCompletePrompt && (
          <AllCompletePrompt
            assignmentId={assignment.id}
            onMarkComplete={handleMarkComplete}
            dismissed={dismissed}
            onDismissChange={() => setPromptDismissed(assignment.id, true)}
          />
        )}

        {/* Sub-tasks Section */}
        <section ref={subtasksSectionRef} className="assignment-detail__section" aria-labelledby="subtasks-heading">
          <h2 id="subtasks-heading" className="assignment-detail__section-title">
            Sub-tasks
          </h2>
          <SubTaskList assignmentId={assignment.id} />
        </section>

        {/* Notes Section */}
        <section className="assignment-detail__section" aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="assignment-detail__section-title">
            Notes
          </h2>
          <NotesList assignmentId={assignment.id} />
        </section>

        {/* Assignment metadata footer */}
        <footer className="assignment-detail__footer">
          <div className="assignment-detail__meta-item">
            <span className="assignment-detail__meta-label">Created</span>
            <span className="assignment-detail__meta-value">
              {new Date(assignment.createdAt).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="assignment-detail__meta-item">
            <span className="assignment-detail__meta-label">Updated</span>
            <span className="assignment-detail__meta-value">
              {new Date(assignment.updatedAt).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </footer>
      </div>
    </article>
  );
}