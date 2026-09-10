/**
 * Toolbar Component — Secondary Row
 *
 * Organize controls: Course filter, Due date filter, Sort, Group, View toggle.
 * Compact dropdown chips with chevrons.
 * Matches: docs/design-inspo/courseflow-dashbar-redesign.html
 *
 * @module @frontend/components/Toolbar
 */

import React from 'react';

import './Toolbar.css';

interface ToolbarProps {
  /** Course filter: selected course names */
  courseFilter?: string[];
  /** Called when course filter changes */
  onCourseFilterChange?: (courses: string[]) => void;
  /** Available courses for filter dropdown */
  availableCourses?: string[];
  /** Due date filter */
  dueDateFilter?: string;
  /** Called when due date filter changes */
  onDueDateFilterChange?: (filter: string) => void;
  /** Sort option */
  sortOption?: string;
  /** Called when sort option changes */
  onSortChange?: (option: string) => void;
  /** Group option */
  groupOption?: string;
  /** Called when group option changes */
  onGroupChange?: (option: string) => void;
  /** View mode: 'flat' | 'grouped' */
  viewMode?: 'flat' | 'grouped';
  /** Called when view mode changes */
  onViewModeChange?: (mode: 'flat' | 'grouped') => void;
}

export function Toolbar({
  courseFilter = [],
  onCourseFilterChange,
  availableCourses = [],
  dueDateFilter = 'any',
  onDueDateFilterChange,
  sortOption = 'priority',
  onSortChange,
  groupOption = 'none',
  onGroupChange,
  viewMode = 'flat',
  onViewModeChange,
}: ToolbarProps): JSX.Element {
  const courseLabel = courseFilter.length === 0 ? 'Courses' :
    courseFilter.length === 1 ? courseFilter[0] :
    `${courseFilter.length} courses`;

  const dueDateLabel = dueDateFilter === 'any' ? 'Any date' : dueDateFilter;

  const sortLabel = sortOption === 'priority' ? 'Priority' :
    sortOption === 'dueDateAsc' ? 'Due date (asc)' :
    sortOption === 'dueDateDesc' ? 'Due date (desc)' :
    sortOption === 'course' ? 'Course' :
    sortOption === 'createdDesc' ? 'Created' : sortOption;

  const groupLabel = groupOption === 'none' ? 'None' :
    groupOption === 'course' ? 'Course' :
    groupOption === 'week' ? 'Week' :
    groupOption === 'status' ? 'Status' : groupOption;

  return (
    <div className="bar-toolbar" role="toolbar" aria-label="Assignment list controls">
      <div className="tb-group">
        {/* Course Filter Chip */}
        <div className="chip">
          <span className="muted">Course</span>
          <span>{courseLabel}</span>
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6"/>
          </svg>
          {courseFilter.length > 0 && (
            <span className="count">{courseFilter.length}</span>
          )}
        </div>

        {/* Due Date Filter Chip */}
        <div className="chip">
          <span className="muted">Due</span>
          <span>{dueDateLabel}</span>
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>

      <div className="tb-divider" aria-hidden="true" />

      <div className="tb-group">
        {/* Sort Chip */}
        <div className="chip">
          <span className="muted">Sort</span>
          <span>{sortLabel}</span>
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>

        {/* Group Chip */}
        <div className="chip">
          <span className="muted">Group</span>
          <span>{groupLabel}</span>
          <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>

      <div className="tb-spacer" />

      {/* View Toggle */}
      <div className="view-toggle" role="group" aria-label="View mode">
        <button
          className={`view-btn ${viewMode === 'flat' ? 'active' : ''}`}
          onClick={() => onViewModeChange?.('flat')}
          title="Flat list"
          aria-pressed={viewMode === 'flat'}
          type="button"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
        </button>
        <button
          className={`view-btn ${viewMode === 'grouped' ? 'active' : ''}`}
          onClick={() => onViewModeChange?.('grouped')}
          title="Grouped"
          aria-pressed={viewMode === 'grouped'}
          type="button"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="4" width="7" height="7" rx="1"/>
            <rect x="14" y="4" width="7" height="7" rx="1"/>
            <rect x="3" y="15" width="7" height="7" rx="1"/>
            <rect x="14" y="15" width="7" height="7" rx="1"/>
          </svg>
        </button>
      </div>
    </div>
  );
}