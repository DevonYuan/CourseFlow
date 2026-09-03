/**
 * GroupHeader — Collapsible Group Header Component
 *
 * Renders a collapsible section header for grouped assignments.
 * Includes label, count, and chevron icon with accessibility attributes.
 *
 * @module @frontend/components/AssignmentList/GroupHeader
 */

import { useCallback, useMemo } from 'react';

import type { GroupedAssignments } from '../../store/grouping';

import './GroupHeader.css';

interface GroupHeaderProps {
  /** The group data */
  group: GroupedAssignments;
  /** Whether the group is currently expanded */
  isExpanded: boolean;
  /** Callback fired when header is clicked to toggle collapse/expand */
  onToggle: (groupKey: string) => void;
  /** Unique ID for aria-controls association */
  groupId: string;
}

/**
 * Group header component with collapsible functionality.
 * Uses native button element for accessibility with proper ARIA attributes.
 */
export function GroupHeader({ group, isExpanded, onToggle, groupId }: GroupHeaderProps): JSX.Element {
  const controlsId = useMemo(() => `group-${groupId}`, [groupId]);
  const labelledById = useMemo(() => `group-label-${groupId}`, [groupId]);

  const handleClick = useCallback(() => {
    onToggle(group.groupKey);
  }, [onToggle, group.groupKey]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onToggle(group.groupKey);
      }
    },
    [onToggle, group.groupKey]
  );

  return (
    <button
      type="button"
      className={`group-header ${isExpanded ? 'group-header--expanded' : 'group-header--collapsed'}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-expanded={isExpanded}
      aria-controls={controlsId}
      aria-labelledby={labelledById}
      data-group-key={group.groupKey}
    >
      <span id={labelledById} className="group-header__label">
        {group.groupLabel}
      </span>
      <span className="group-header__count" aria-label={`${group.count} assignments`}>
        {group.count}
      </span>
      <span
        className={`group-header__chevron ${isExpanded ? 'group-header__chevron--expanded' : ''}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>
    </button>
  );
}