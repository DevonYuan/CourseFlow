/**
 * AssignmentDetailPage — Assignment Detail View Page
 *
 * Displays full assignment information including title, course, due date,
 * status, and Canvas description. Provides back navigation and handles
 * loading/error/not-found states.
 *
 * @module @frontend/pages/AssignmentDetailPage
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { Assignment } from '@backend/shared/types';
import { StatusBadge } from '../components/AssignmentList/StatusBadge';
import { CourseColorBadge } from '../components/CourseColorBadge';
import { formatDueDateDetail } from '../utils/date';
import { createSafeHtml } from '../utils/sanitize';
import { useToast } from '../context/ToastContext';

import './AssignmentDetailPage.css';

interface DetailPageState {
  assignment: Assignment | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

/**
 * Hook to fetch assignment details and subscribe to live updates.
 */
function useAssignmentDetail(id: string): DetailPageState & { refetch: () => Promise<void> } {
  const [state, setState] = useState<DetailPageState>({
    assignment: null,
    isLoading: true,
    error: null,
    notFound: false,
  });

  const refetch = async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await window.api.db.assignments.get(id);
      if (result.ok) {
        if (result.data) {
          setState({ assignment: result.data, isLoading: false, error: null, notFound: false });
        } else {
          setState({ assignment: null, isLoading: false, error: null, notFound: true });
        }
      } else {
        setState({
          assignment: null,
          isLoading: false,
          error: result.error || 'Failed to load assignment',
          notFound: false,
        });
      }
    } catch {
      setState({
        assignment: null,
        isLoading: false,
        error: 'Failed to load assignment',
        notFound: false,
      });
    }
  };

  // Initial fetch
  useEffect(() => {
    void refetch();
  }, [id]);

  // Subscribe to database changes for live updates
  useEffect(() => {
    const unsubscribe = window.api.onDbChanged((event) => {
      if (event.table === 'assignments' && event.id === id) {
        if (event.action === 'delete') {
          setState((prev) => ({ ...prev, notFound: true, assignment: null }));
        } else {
          void refetch();
        }
      }
    });
    return unsubscribe;
  }, [id, refetch]);

  return { ...state, refetch };
}

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
 * and the Canvas description content.
 */
export function AssignmentDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { error: toastError } = useToast();

  const assignmentId = id ?? '';
  const { assignment, isLoading, error, notFound, refetch } = useAssignmentDetail(assignmentId);

  const handleBack = () => {
    navigate(-1);
  };

  const handleRetry = async () => {
    await refetch();
  };

  const handleOpenInCanvas = () => {
    if (assignment?.htmlUrl) {
      window.open(assignment.htmlUrl, '_blank', 'noopener,noreferrer');
    }
  };

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

  const { label: dueDateLabel, isOverdue, isAllDay } = formatDueDateDetail(assignment.dueAt);
  const statusLabels: Record<Assignment['status'], string> = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    archived: 'Archived',
  };

  return (
    <article className="assignment-detail" role="main" aria-label={assignment.title}>
      {/* Header Section */}
      <header className="assignment-detail__header">
        {/* Back button */}
        <button
          className="assignment-detail__back"
          onClick={handleBack}
          type="button"
          aria-label="Back to assignments"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>

        {/* Title and Course */}
        <div className="assignment-detail__title-section">
          <h1 className="assignment-detail__title">{assignment.title}</h1>
          <div className="assignment-detail__course">
            <CourseColorBadge
              color={assignment.courseColor}
              variant="dot"
              size={12}
              ariaLabel={`${assignment.courseName} color`}
            />
            <span className="assignment-detail__course-name">{assignment.courseName}</span>
          </div>
        </div>

        {/* Meta: Due date, status, points */}
        <div className="assignment-detail__meta">
          <div className="assignment-detail__due-date">
            <svg className="assignment-detail__due-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span
              className={`assignment-detail__due-label${isOverdue ? ' assignment-detail__due-label--overdue' : ''}${isAllDay ? ' assignment-detail__due-label--allday' : ''}`}
            >
              {dueDateLabel}
            </span>
          </div>

          <StatusBadge status={assignment.status} size="md" />

          {assignment.pointsPossible !== null && assignment.pointsPossible > 0 && (
            <span className="assignment-detail__points" aria-label={`Worth ${assignment.pointsPossible} points`}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {assignment.pointsPossible} pts
            </span>
          )}
        </div>
      </header>

      {/* Content Section */}
      <div className="assignment-detail__content">
        {/* Canvas Description */}
        {assignment.description && assignment.description.trim() !== '' && (
          <section className="assignment-detail__section" aria-labelledby="description-heading">
            <h2 id="description-heading" className="assignment-detail__section-title">
              Description
            </h2>
            <div
              className="assignment-detail__description"
              dangerouslySetInnerHTML={createSafeHtml(assignment.description)}
            />
          </section>
        )}

        {/* Placeholder for Sub-tasks (Ticket 3.3) */}
        <section className="assignment-detail__section" aria-labelledby="subtasks-heading">
          <h2 id="subtasks-heading" className="assignment-detail__section-title">
            Sub-tasks
          </h2>
          <div className="assignment-detail__placeholder">
            <p>Sub-tasks will appear here. <em>(Coming in Ticket 3.3)</em></p>
          </div>
        </section>

        {/* Placeholder for Notes (Ticket 3.6) */}
        <section className="assignment-detail__section" aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="assignment-detail__section-title">
            Notes
          </h2>
          <div className="assignment-detail__placeholder">
            <p>Notes will appear here. <em>(Coming in Ticket 3.6)</em></p>
          </div>
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
          {assignment.htmlUrl && (
            <button
              className="assignment-detail__canvas-link"
              onClick={handleOpenInCanvas}
              type="button"
              aria-label={`Open ${assignment.title} in Canvas`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open in Canvas
            </button>
          )}
        </footer>
      </div>
    </article>
  );
}