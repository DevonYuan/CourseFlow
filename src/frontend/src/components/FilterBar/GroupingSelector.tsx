/**
 * GroupingSelector — Filter Bar Grouping Option Component
 *
 * Dropdown select for choosing assignment grouping mode.
 * Updates the groupingType filter in the Zustand store and persists to localStorage.
 *
 * @module @frontend/components/FilterBar/GroupingSelector
 */

import type { GroupingType } from '@backend/shared/types';

import { useGroupingType, useSetGroupingType } from '../../store/assignmentsStore';

import './GroupingSelector.css';

interface GroupingOptionConfig {
  value: GroupingType;
  label: string;
  icon: string;
}

const GROUPING_OPTIONS: GroupingOptionConfig[] = [
  {
    value: 'none',
    label: 'Flat List',
    icon: '☰',
  },
  {
    value: 'week',
    label: 'This Week / Overdue / Upcoming',
    icon: '📅',
  },
  {
    value: 'status',
    label: 'Pending / In Progress / Completed',
    icon: '✓',
  },
  {
    value: 'course',
    label: 'By Course',
    icon: '🎓',
  },
];

/**
 * Grouping selector component.
 * Renders an accessible native <select> with all grouping options.
 */
export function GroupingSelector(): JSX.Element {
  const groupingType = useGroupingType();
  const setGroupingType = useSetGroupingType();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const option =
      value === 'none' || value === 'week' || value === 'status' || value === 'course'
        ? value
        : 'none';
    setGroupingType(option);
  };

  return (
    <div className="grouping-selector">
      <label htmlFor="grouping-select" className="grouping-selector__label">
        Group by
      </label>
      <select
        id="grouping-select"
        className="grouping-selector__select"
        value={groupingType}
        onChange={handleChange}
        aria-label="Group assignments by"
        data-testid="grouping-dropdown"
      >
        {GROUPING_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.icon} {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
