/**
 * SortDropdown — Filter Bar Sort Option Component
 *
 * Dropdown select for choosing assignment sort order.
 * Updates the sortOption filter in the Zustand store and persists to localStorage.
 *
 * @module @frontend/components/FilterBar/SortDropdown
 */

import type { SortOption } from '@backend/shared/types';

import { useSortOption, useSetSortOption } from '../../store/assignmentsStore';

import './SortDropdown.css';

interface SortOptionConfig {
  value: SortOption;
  label: string;
  description: string;
}

const SORT_OPTIONS: SortOptionConfig[] = [
  {
    value: 'priority',
    label: 'Priority (custom)',
    description: 'Your custom drag-and-drop order',
  },
  {
    value: 'dueDateAsc',
    label: 'Due Date (soonest first)',
    description: 'Sort by due date ascending',
  },
  {
    value: 'dueDateDesc',
    label: 'Due Date (latest first)',
    description: 'Sort by due date descending',
  },
  {
    value: 'course',
    label: 'Course (A–Z)',
    description: 'Sort alphabetically by course name',
  },
  {
    value: 'createdDesc',
    label: 'Created (newest first)',
    description: 'Sort by creation date descending',
  },
];

/**
 * Sort dropdown component.
 * Renders an accessible native <select> with all sort options.
 */
export function SortDropdown(): JSX.Element {
  const sortOption = useSortOption();
  const setSortOption = useSetSortOption();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const option = event.target.value as SortOption;
    setSortOption(option);
  };

  return (
    <div className="sort-dropdown">
      <label htmlFor="sort-select" className="sort-dropdown__label">
        Sort by
      </label>
      <select
        id="sort-select"
        className="sort-dropdown__select"
        value={sortOption}
        onChange={handleChange}
        aria-label="Sort assignments by"
        data-testid="sort-dropdown"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} title={option.description}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}