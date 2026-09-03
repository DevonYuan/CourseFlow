/**
 * CourseChips — Filter Bar Course Filter Component
 *
 * Horizontal scrollable chips showing each course with colored dot, name, and assignment count.
 * Click to toggle. "All courses" chip to clear filter.
 * Collapses into dropdown on screens < 1000px.
 *
 * @module @frontend/components/FilterBar/CourseChips
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useAssignments, useCourseFilter, useSetCourseFilter, useToggleCourseFilter } from '../../store/assignmentsStore';
import { CourseColorBadge } from '../CourseColorBadge';

import './CourseChips.css';

interface CourseChipData {
  name: string;
  color: string;
  count: number;
  isSelected: boolean;
}

/**
 * Course chips filter component.
 * Displays courses as toggleable chips with color indicators and assignment counts.
 * Responsive: chips on desktop, dropdown on mobile (< 1000px).
 */
export function CourseChips(): JSX.Element {
  const assignments = useAssignments();
  const courseFilter = useCourseFilter();
  const toggleCourseFilter = useToggleCourseFilter();
  const setCourseFilter = useSetCourseFilter();

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

  // Derive course data with counts, sorted by count desc then alphabetically
  const courses = useMemo((): CourseChipData[] => {
    const courseMap = new Map<string, { color: string; count: number }>();

    assignments.forEach((assignment) => {
      const existing = courseMap.get(assignment.courseName);
      if (existing) {
        existing.count += 1;
      } else {
        courseMap.set(assignment.courseName, {
          color: assignment.courseColor || '#888',
          count: 1,
        });
      }
    });

    return [...courseMap.entries()]
      .map(([name, data]) => ({
        name,
        color: data.color,
        count: data.count,
        isSelected: courseFilter.includes(name),
      }))
      .sort((a, b) => {
        // Sort by count desc, then alphabetically
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
      });
  }, [assignments, courseFilter]);

  const hasActiveFilters = courseFilter.length > 0;
  const selectedCount = courseFilter.length;

  const handleChipClick = (courseName: string) => {
    toggleCourseFilter(courseName);
  };

  const handleClearAll = () => {
    setCourseFilter([]);
    setIsDropdownOpen(false);
  };

  const handleDropdownToggle = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const handleDropdownItemClick = (courseName: string) => {
    toggleCourseFilter(courseName);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, courseName: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleCourseFilter(courseName);
    } else if (event.key === 'Escape') {
      setIsDropdownOpen(false);
      triggerRef.current?.focus();
    }
  };

  const handleDropdownKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsDropdownOpen(false);
      triggerRef.current?.focus();
    }
  };

  // Desktop view (chips) - show when screen width >= 1000px
  // Mobile view (dropdown) - show when screen width < 1000px
  // We use CSS media queries to handle this, but we need to render both for SSR/hydration consistency
  // The CSS will handle visibility

  return (
    <div className="course-chips" role="group" aria-label="Filter by course">
      {/* "All courses" chip - always visible on desktop, part of dropdown on mobile */}
      <div className="course-chips__all-wrapper">
        <button
          type="button"
          className={`course-chips__chip course-chips__chip--all ${hasActiveFilters ? 'course-chips__chip--active' : ''}`}
          onClick={handleClearAll}
          aria-pressed={hasActiveFilters}
          aria-label={hasActiveFilters ? 'Clear course filter' : 'All courses (no filter)'}
        >
          <CourseColorBadge
            color="#888"
            variant="dot"
            size={8}
            aria-hidden="true"
          />
          <span className="course-chips__chip-label">All courses</span>
          {hasActiveFilters && (
            <span className="course-chips__chip-count" aria-label={`${selectedCount} courses selected`}>
              {selectedCount}
            </span>
          )}
        </button>
      </div>

      {/* Desktop: Horizontal scrollable chips */}
      <div className="course-chips__scroll-wrapper" aria-label="Course filter chips">
        <div className="course-chips__chips" role="listbox" aria-multiselectable="true">
          {courses.map((course) => (
            <button
              key={course.name}
              type="button"
              role="option"
              aria-selected={course.isSelected}
              aria-label={`${course.name}: ${course.count} assignment${course.count === 1 ? '' : 's'}. ${course.isSelected ? 'Selected' : 'Not selected'}. Press to toggle.`}
              className={`course-chips__chip ${course.isSelected ? 'course-chips__chip--selected' : ''}`}
              onClick={() => handleChipClick(course.name)}
              onKeyDown={(e) => handleKeyDown(e, course.name)}
            >
              <CourseColorBadge
                color={course.color}
                variant="dot"
                size={8}
                aria-hidden="true"
              />
              <span className="course-chips__chip-label">{course.name}</span>
              <span className="course-chips__chip-count" aria-hidden="true">{course.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: Dropdown trigger and menu */}
      <div className="course-chips__dropdown-wrapper">
        <button
          ref={triggerRef}
          type="button"
          className="course-chips__dropdown-trigger"
          onClick={handleDropdownToggle}
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
          aria-label={hasActiveFilters ? `${selectedCount} courses selected` : 'Filter by course'}
        >
          <CourseColorBadge
            color="#888"
            variant="dot"
            size={8}
            aria-hidden="true"
          />
          <span className="course-chips__dropdown-text">
            {hasActiveFilters ? `${selectedCount} course${selectedCount === 1 ? '' : 's'} selected` : 'Filter by course'}
          </span>
          <svg
            className={`course-chips__dropdown-chevron ${isDropdownOpen ? 'course-chips__dropdown-chevron--open' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {hasActiveFilters && (
            <span className="course-chips__dropdown-badge" aria-label={`${selectedCount} courses selected`}>
              {selectedCount}
            </span>
          )}
        </button>

        {isDropdownOpen && (
          <div
            ref={dropdownRef}
            className="course-chips__dropdown"
            role="listbox"
            aria-multiselectable="true"
            aria-label="Select courses to filter"
            onKeyDown={handleDropdownKeyDown}
          >
            <button
              type="button"
              role="option"
              aria-selected={hasActiveFilters === false}
              className={`course-chips__dropdown-item ${hasActiveFilters === false ? 'course-chips__dropdown-item--selected' : ''}`}
              onClick={handleClearAll}
            >
              <span className="course-chips__dropdown-item-label">All courses</span>
              {hasActiveFilters && (
                <span className="course-chips__dropdown-item-count">{selectedCount} selected</span>
              )}
            </button>
            <div className="course-chips__dropdown-divider" role="separator" />
            {courses.map((course) => (
              <button
                key={course.name}
                type="button"
                role="option"
                aria-selected={course.isSelected}
                className={`course-chips__dropdown-item ${course.isSelected ? 'course-chips__dropdown-item--selected' : ''}`}
                onClick={() => handleDropdownItemClick(course.name)}
              >
                <CourseColorBadge
                  color={course.color}
                  variant="dot"
                  size={8}
                  aria-hidden="true"
                />
                <span className="course-chips__dropdown-item-label">{course.name}</span>
                <span className="course-chips__dropdown-item-count" aria-hidden="true">{course.count}</span>
                {course.isSelected && (
                  <svg
                    className="course-chips__dropdown-item-check"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}