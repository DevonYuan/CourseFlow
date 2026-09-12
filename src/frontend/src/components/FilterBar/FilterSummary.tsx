/**
 * FilterSummary — Filter Bar Active Filters Summary
 *
 * Displays active filters as removable chips with a "Clear all" button.
 * Shows badge count of active filters in the toolbar.
 *
 * @module @frontend/components/FilterBar/FilterSummary
 */

import type { IsoDateTime } from '@backend/shared/types';
import { useMemo } from 'react';

import {
  useCourseFilter,
  useDueDateRange,
  useResetFilters,
  useSearchQuery,
  useSetCourseFilter,
  useSetDueDateRange,
  useSetSearchQuery,
  useSetStatusFilter,
  useStatusFilter,
} from '../../store/assignmentsStore';
import { CourseColorBadge } from '../CourseColorBadge';

import './FilterSummary.css';

interface ActiveFilter {
  id: string;
  label: string;
  onRemove: () => void;
  color?: string;
}

/**
 * Converts IsoDateTime (ISO string) to Date for formatting.
 */
function isoToDate(iso: IsoDateTime | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Filter summary component showing active filters as removable chips.
 */
export function FilterSummary(): JSX.Element | null {
  const resetFilters = useResetFilters();
  const courseFilter = useCourseFilter();
  const setCourseFilter = useSetCourseFilter();
  const statusFilter = useStatusFilter();
  const setStatusFilter = useSetStatusFilter();
  const dueDateRange = useDueDateRange();
  const setDueDateRange = useSetDueDateRange();
  const searchQuery = useSearchQuery();
  const setSearchQuery = useSetSearchQuery();

  // Build active filters list
  const activeFilters = useMemo((): ActiveFilter[] => {
    const filters: ActiveFilter[] = [];

    // Course filters
    courseFilter.forEach((course) => {
      filters.push({
        id: `course-${course}`,
        label: course,
        onRemove: () => setCourseFilter(courseFilter.filter((c) => c !== course)),
      });
    });

    // Status filter (only if not 'all')
    if (statusFilter !== 'all') {
      filters.push({
        id: `status-${statusFilter}`,
        label: `Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`,
        onRemove: () => setStatusFilter('all'),
      });
    }

    // Date range filter
    if (dueDateRange) {
      const formatDate = (iso: IsoDateTime) => {
        const date = isoToDate(iso);
        return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '∞';
      };
      const startStr = dueDateRange.start ? formatDate(dueDateRange.start) : '∞';
      const endStr = dueDateRange.end ? formatDate(dueDateRange.end) : '∞';
      filters.push({
        id: 'date-range',
        label: `Due: ${startStr} – ${endStr}`,
        onRemove: () => setDueDateRange(null),
      });
    }

    // Search query
    if (searchQuery) {
      filters.push({
        id: 'search',
        label: `Search: "${searchQuery}"`,
        onRemove: () => setSearchQuery(''),
      });
    }

    return filters;
  }, [
    courseFilter,
    setCourseFilter,
    statusFilter,
    setStatusFilter,
    dueDateRange,
    setDueDateRange,
    searchQuery,
    setSearchQuery,
  ]);

  const hasActiveFilters = activeFilters.length > 0;

  if (hasActiveFilters === false) {
    return null;
  }

  const handleClearAll = () => {
    resetFilters();
  };

  return (
    <div
      className="filter-summary"
      role="status"
      aria-live="polite"
      aria-label={`${activeFilters.length} active filter${activeFilters.length === 1 ? '' : 's'}`}
    >
      <div className="filter-summary__chips">
        {activeFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className="filter-summary__chip"
            onClick={filter.onRemove}
            aria-label={`Remove filter: ${filter.label}`}
          >
            {filter.color && (
              <CourseColorBadge color={filter.color} variant="dot" size={6} aria-hidden="true" />
            )}
            <span className="filter-summary__chip-label">{filter.label}</span>
            <svg
              className="filter-summary__chip-remove"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="filter-summary__clear-all"
        onClick={handleClearAll}
        aria-label={`Clear all ${activeFilters.length} filters`}
        data-testid="clear-all-filters"
      >
        Clear all
      </button>
    </div>
  );
}
