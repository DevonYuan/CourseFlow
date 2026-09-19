/**
 * CalendarFilter — Filter Bar Calendar Source Filter Component
 *
 * Horizontal scrollable chips showing each calendar source with colored dot, name, and assignment count.
 * Click to toggle. "All calendars" chip to clear filter.
 * Collapses into dropdown on screens < 1000px.
 *
 * @module @frontend/components/FilterBar/CalendarFilter
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useAssignments, useCalendarFilter, useSetCalendarFilter, useToggleCalendarFilter } from '../../store/assignmentsStore';
import { useCalendarsStore } from '../../stores/calendarsStore';

import './CourseChips.css'; // Reuse CourseChips styles since the UI is identical

interface CalendarChipData {
  id: string;
  name: string;
  color: string;
  count: number;
  isSelected: boolean;
  enabled: boolean;
  position: number;
}

/**
 * Calendar chips filter component.
 * Displays calendar sources as toggleable chips with color indicators and assignment counts.
 * Only shows enabled calendars.
 * Responsive: chips on desktop, dropdown on mobile (< 1000px).
 */
export function CalendarFilter(): JSX.Element {
  const calendars = useCalendarsStore((state) => state.calendars);
  const assignments = useAssignments();
  const calendarFilter = useCalendarFilter();
  const toggleCalendarFilter = useToggleCalendarFilter();
  const setCalendarFilter = useSetCalendarFilter();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Derive calendar data with counts, sorted by position
  const calendarChips = useMemo((): CalendarChipData[] => {
    // Count assignments per calendar source
    const countMap = new Map<string, number>();
    assignments.forEach((assignment) => {
      if (assignment.sourceId) {
        countMap.set(assignment.sourceId, (countMap.get(assignment.sourceId) ?? 0) + 1);
      }
    });

    return calendars
      .filter((cal) => cal.enabled)
      .map((cal) => ({
        id: cal.id,
        name: cal.name,
        color: cal.color,
        count: countMap.get(cal.id) ?? 0,
        isSelected: calendarFilter.includes(cal.id),
        enabled: cal.enabled,
        position: cal.position,
      }))
      .sort((a, b) => a.position - b.position);
  }, [calendars, assignments, calendarFilter]);

  const hasActiveFilters = calendarFilter.length > 0;
  const selectedCount = calendarFilter.length;

  const handleChipClick = (calendarId: string) => {
    toggleCalendarFilter(calendarId);
  };

  const handleClearAll = () => {
    setCalendarFilter([]);
  };

  const handleAllCalendarsClick = () => {
    if (hasActiveFilters) {
      handleClearAll();
    }
  };

  // Responsive: chips on desktop (>= 1000px), dropdown on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1000;

  if (isMobile) {
    return (
      <div className="course-chips course-chips--dropdown" role="group" aria-label="Filter by calendar">
        <button
          ref={triggerRef}
          type="button"
          className={`course-chips__dropdown-trigger ${hasActiveFilters ? 'course-chips__dropdown-trigger--active' : ''}`}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          aria-expanded={isDropdownOpen}
          aria-haspopup="listbox"
          aria-label={`Calendars${hasActiveFilters ? `, ${selectedCount} selected` : ''}`}
          data-testid="calendar-filter-dropdown-trigger"
        >
          <span className="course-chips__dropdown-label">Calendars</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className="course-chips__dropdown"
            role="listbox"
            aria-label="Select calendars"
            data-testid="calendar-filter-dropdown"
          >
            <button
              type="button"
              role="option"
              aria-selected={isAllSelected}
              className={`course-chip ${isAllSelected ? 'course-chip--selected' : ''}`}
              onClick={handleAllCalendarsClick}
              data-testid="calendar-chip-all"
            >
              <span className="course-chip__dot" style={{ backgroundColor: 'var(--ink-faint)' }} aria-hidden="true"></span>
              <span className="course-chip__name">All calendars</span>
            </button>
            {calendarChips.map((calendar) => (
              <button
                key={calendar.id}
                type="button"
                role="option"
                aria-selected={calendar.isSelected}
                className={`course-chip ${calendar.isSelected ? 'course-chip--selected' : ''}`}
                onClick={() => handleChipClick(calendar.id)}
                style={{ '--calendar-color': calendar.color } as React.CSSProperties}
                data-testid={`calendar-chip-${calendar.id}`}
              >
                <span className="course-chip__dot" style={{ backgroundColor: calendar.color }} aria-hidden="true"></span>
                <span className="course-chip__name">{calendar.name}</span>
                <span className="course-chip__count">{calendar.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop: horizontal scrollable chips
  const isAllSelected = !hasActiveFilters;
  return (
    <div className="course-chips" role="group" aria-label="Filter by calendar">
      <button
        type="button"
        className={`course-chip course-chip--all ${isAllSelected ? 'course-chip--selected' : ''}`}
        onClick={handleAllCalendarsClick}
        aria-pressed={isAllSelected}
        data-testid="calendar-chip-all"
      >
        <span className="course-chip__dot" style={{ backgroundColor: 'var(--ink-faint)' }} aria-hidden="true"></span>
        <span className="course-chip__name">All calendars</span>
      </button>
      <div className="course-chips__scroll" data-testid="calendar-chips-scroll">
        {calendarChips.map((calendar) => (
          <button
            key={calendar.id}
            type="button"
            className={`course-chip ${calendar.isSelected ? 'course-chip--selected' : ''}`}
            onClick={() => handleChipClick(calendar.id)}
            aria-pressed={calendar.isSelected}
            style={{ '--calendar-color': calendar.color } as React.CSSProperties}
            data-testid={`calendar-chip-${calendar.id}`}
          >
            <span className="course-chip__dot" style={{ backgroundColor: calendar.color }} aria-hidden="true"></span>
            <span className="course-chip__name">{calendar.name}</span>
            <span className="course-chip__count">{calendar.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}