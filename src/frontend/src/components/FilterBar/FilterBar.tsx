/**
 * FilterBar — Main Filter Toolbar Component
 *
 * Combines SearchInput, StatusTabs, CourseChips, DateRangePicker, and FilterSummary
 * into a responsive filter toolbar for the assignment list.
 *
 * @module @frontend/components/FilterBar/FilterBar
 */

import { useMemo } from 'react';

import { useFilters, useResetFilters, useSetDueDateRange } from '../../store/assignmentsStore';

import { CourseChips } from './CourseChips';
import { DateRangePicker } from './DateRangePicker';
import { FilterSummary } from './FilterSummary';
import { SearchInput } from './SearchInput';
import { SortDropdown } from './SortDropdown';
import { StatusTabs } from './StatusTabs';

import './FilterBar.css';

/**
 * Main filter bar component.
 * Renders all filter controls in a responsive toolbar layout.
 */
export function FilterBar(): JSX.Element {
  const filters = useFilters();
  const resetFilters = useResetFilters();
  const setDueDateRange = useSetDueDateRange();

  // Calculate total active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.courseFilter.length > 0) count += filters.courseFilter.length;
    if (filters.statusFilter !== 'all') count += 1;
    if (filters.dueDateRange) count += 1;
    if (filters.searchQuery) count += 1;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="filter-bar" role="search" aria-label="Assignment filters">
      {/* Row 1: Search and Status */}
      <div className="filter-bar__row filter-bar__row--primary">
        <div className="filter-bar__search-wrapper">
          <SearchInput value={filters.searchQuery} />
        </div>
        <div className="filter-bar__status-wrapper">
          <label htmlFor="filter-status" className="visually-hidden">
            Filter by status
          </label>
          <StatusTabs />
        </div>
      </div>

      {/* Row 2: Course chips, Date range, and Sort */}
      <div className="filter-bar__row filter-bar__row--secondary">
        <div className="filter-bar__course-wrapper">
          <CourseChips />
        </div>
        <div className="filter-bar__date-wrapper">
          <DateRangePicker
            value={filters.dueDateRange}
            onChange={setDueDateRange}
          />
        </div>
        <div className="filter-bar__sort-wrapper">
          <SortDropdown />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            className="filter-bar__clear-all"
            onClick={resetFilters}
            aria-label={`Clear all ${activeFilterCount} filters`}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active filters summary */}
      <FilterSummary />
    </div>
  );
}