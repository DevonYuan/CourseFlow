/**
 * FilterBar — Main Filter Toolbar Component
 *
 * Combines SearchInput, StatusTabs, CourseChips, DateRangePicker, GroupingSelector, and FilterSummary
 * into a responsive filter toolbar for the assignment list.
 *
 * @module @frontend/components/FilterBar/FilterBar
 */

import type { IsoDateTime } from '@backend/shared/types';
import { useMemo } from 'react';

import { useFilters, useResetFilters, useSetDueDateRange } from '../../store/assignmentsStore';

import { CourseChips } from './CourseChips';
import { DateRangePicker } from './DateRangePicker';
import { FilterSummary } from './FilterSummary';
import { GroupingSelector } from './GroupingSelector';
import { SearchInput } from './SearchInput';
import { SortDropdown } from './SortDropdown';
import { StatusTabs } from './StatusTabs';

import './FilterBar.css';

/**
 * Converts IsoDateTime (ISO string) to Date for UI components.
 */
function isoToDate(iso: IsoDateTime | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Converts Date to IsoDateTime (ISO string) for store.
 */
function dateToIso(date: Date | null): IsoDateTime | null {
  if (!date) return null;
  return date.toISOString() as IsoDateTime;
}

/**
 * Converts a dueDateRange with IsoDateTime to one with Date objects.
 */
function convertRangeToDate(
  range: { start: IsoDateTime; end: IsoDateTime } | null,
): { start: Date; end: Date } | null {
  if (!range) return null;
  return {
    start: isoToDate(range.start) ?? new Date(),
    end: isoToDate(range.end) ?? new Date(),
  };
}

/**
 * Converts a dueDateRange with Date objects to one with IsoDateTime.
 */
function convertRangeToIso(
  range: { start: Date; end: Date } | null,
): { start: IsoDateTime; end: IsoDateTime } | null {
  if (!range || !range.start || !range.end) return null;
  return {
    start: dateToIso(range.start) as IsoDateTime,
    end: dateToIso(range.end) as IsoDateTime,
  };
}

/**
 * Main filter bar component.
 * Renders all filter controls in a responsive toolbar layout.
 */
export function FilterBar(): JSX.Element {
  const filters = useFilters();
  const resetFilters = useResetFilters();
  const setDueDateRange = useSetDueDateRange();

  // Convert store's IsoDateTime range to Date for DateRangePicker
  const dateRangeForPicker = useMemo(
    () => convertRangeToDate(filters.dueDateRange),
    [filters.dueDateRange],
  );

  // Wrap setDueDateRange to convert Date back to IsoDateTime
  const handleDateRangeChange = useMemo(
    () => (range: { start: Date; end: Date } | null) => setDueDateRange(convertRangeToIso(range)),
    [setDueDateRange],
  );

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

      {/* Row 2: Course chips, Date range, Sort, and Grouping */}
      <div className="filter-bar__row filter-bar__row--secondary">
        <div className="filter-bar__course-wrapper">
          <CourseChips />
        </div>
        <div className="filter-bar__date-wrapper">
          <DateRangePicker value={dateRangeForPicker} onChange={handleDateRangeChange} />
        </div>
        <div className="filter-bar__sort-wrapper">
          <SortDropdown />
        </div>
        <div className="filter-bar__grouping-wrapper">
          <GroupingSelector />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            className="filter-bar__clear-all"
            onClick={resetFilters}
            aria-label={`Clear all ${activeFilterCount} filters`}
            data-testid="clear-all-filters"
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
