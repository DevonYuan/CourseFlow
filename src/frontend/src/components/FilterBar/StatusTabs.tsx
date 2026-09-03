/**
 * StatusTabs — Filter Bar Status Filter Component
 *
 * Three tabs for filtering by assignment status: All / Pending / Completed.
 * Active tab highlighted with proper ARIA attributes.
 *
 * @module @frontend/components/FilterBar/StatusTabs
 */

import { useStatusFilter, useSetStatusFilter } from '../../store/assignmentsStore';
import './StatusTabs.css';

type StatusFilterValue = 'all' | 'pending' | 'completed';

interface StatusTabConfig {
  value: StatusFilterValue;
  label: string;
  ariaLabel: string;
}

const STATUS_TABS: StatusTabConfig[] = [
  { value: 'all', label: 'All', ariaLabel: 'Show all assignments' },
  { value: 'pending', label: 'Pending', ariaLabel: 'Show pending assignments only' },
  { value: 'completed', label: 'Completed', ariaLabel: 'Show completed assignments only' },
];

/**
 * Status filter tabs component.
 * Renders three tabs with active state indication and keyboard navigation.
 */
export function StatusTabs(): JSX.Element {
  const statusFilter = useStatusFilter();
  const setStatusFilter = useSetStatusFilter();

  const handleTabClick = (value: StatusFilterValue) => {
    setStatusFilter(value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = STATUS_TABS.findIndex((tab) => tab.value === statusFilter);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft': {
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : STATUS_TABS.length - 1;
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        newIndex = currentIndex < STATUS_TABS.length - 1 ? currentIndex + 1 : 0;
        break;
      }
      case 'Home': {
        event.preventDefault();
        newIndex = 0;
        break;
      }
      case 'End': {
        event.preventDefault();
        newIndex = STATUS_TABS.length - 1;
        break;
      }
      default: {
        return;
      }
    }

    const newTab = STATUS_TABS[newIndex];
    if (newTab) {
      setStatusFilter(newTab.value);
      // Focus the new tab
      const tabElement = document.getElementById(`status-tab-${newTab.value}`);
      tabElement?.focus();
    }
  };

  return (
    <div className="status-tabs" role="tablist" aria-label="Filter by status">
      {STATUS_TABS.map((tab) => {
        const isActive = statusFilter === tab.value;
        return (
          <button
            key={tab.value}
            id={`status-tab-${tab.value}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`status-panel-${tab.value}`}
            tabIndex={isActive ? 0 : -1}
            className={`status-tabs__tab ${isActive ? 'status-tabs__tab--active' : ''}`}
            onClick={() => handleTabClick(tab.value)}
            onKeyDown={handleKeyDown}
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
      {/* Active indicator */}
      <div
        className="status-tabs__indicator"
        style={{
          '--active-index': STATUS_TABS.findIndex((tab) => tab.value === statusFilter),
        } as React.CSSProperties}
        aria-hidden="true"
      />
    </div>
  );
}