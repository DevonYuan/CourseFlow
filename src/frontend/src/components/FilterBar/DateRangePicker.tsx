/**
 * DateRangePicker — Filter Bar Date Range Component
 *
 * Two date inputs (From / To) with calendar popover.
 * Preset buttons: This Week, This Month, Overdue, Upcoming.
 * Clear button to reset range.
 * Uses native <input type="date"> with date-fns for preset calculations.
 *
 * @module @frontend/components/FilterBar/DateRangePicker
 */

import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  format,
  isValid,
  parseISO,
} from 'date-fns';
import { useMemo, useState, useRef, useEffect } from 'react';

import './DateRangePicker.css';

type DatePreset = 'thisWeek' | 'thisMonth' | 'overdue' | 'upcoming';

interface DatePresetConfig {
  id: DatePreset;
  label: string;
  getRange: () => { start: Date; end: Date } | null;
}

/**
 * Calculates date range presets using date-fns.
 * All dates are in local timezone.
 */
const DATE_PRESETS: DatePresetConfig[] = [
  {
    id: 'thisWeek',
    label: 'This Week',
    getRange: () => {
      const now = new Date();
      return {
        start: startOfDay(startOfWeek(now, { weekStartsOn: 1 })),
        end: endOfDay(endOfWeek(now, { weekStartsOn: 1 })),
      };
    },
  },
  {
    id: 'thisMonth',
    label: 'This Month',
    getRange: () => {
      const now = new Date();
      return {
        start: startOfDay(startOfMonth(now)),
        end: endOfDay(endOfMonth(now)),
      };
    },
  },
  {
    id: 'overdue',
    label: 'Overdue',
    getRange: () => ({
      start: new Date(-8_640_000_000_000_000), // -∞ (min Date)
      end: endOfDay(new Date()),
    }),
  },
  {
    id: 'upcoming',
    label: 'Upcoming',
    getRange: () => ({
      start: startOfDay(new Date()),
      end: new Date(8_640_000_000_000_000), // +∞ (max Date)
    }),
  },
];

/**
 * Formats a date for the HTML date input (yyyy-MM-dd).
 */
function formatDateForInput(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return '';
  return format(date, 'yyyy-MM-dd');
}

interface DateRangePickerProps {
  /** Current date range value */
  value: { start: Date; end: Date } | null;
  /** Callback when range changes */
  onChange: (range: { start: Date; end: Date } | null) => void;
  /** ARIA label for the component */
  ariaLabel?: string;
}

/**
 * Date range picker with From/To inputs, preset buttons, and clear action.
 */
export function DateRangePicker({ value, onChange, ariaLabel = 'Filter by due date range' }: DateRangePickerProps): JSX.Element {
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close presets when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        presetsRef.current &&
        !presetsRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsPresetsOpen(false);
      }
    }

    if (isPresetsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPresetsOpen]);

  const handlePresetClick = (preset: DatePresetConfig) => {
    const range = preset.getRange();
    onChange(range);
    setIsPresetsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsPresetsOpen(false);
  };

  const handleFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = event.target.value;
    if (!dateStr) {
      onChange(null);
      return;
    }
    const newStart = parseISO(dateStr);
    if (isValid(newStart)) {
      onChange({ start: newStart, end: value?.end ?? new Date(8_640_000_000_000_000) });
    }
  };

  const handleToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = event.target.value;
    if (!dateStr) {
      onChange(null);
      return;
    }
    const newEnd = parseISO(dateStr);
    if (isValid(newEnd)) {
      onChange({ start: value?.start ?? new Date(-8_640_000_000_000_000), end: newEnd });
    }
  };

  const hasActiveRange = value !== null && (value.start || value.end);

  // Determine if current value matches a preset
  const activePreset = useMemo(() => {
    if (!value) return null;
    for (const preset of DATE_PRESETS) {
      const presetRange = preset.getRange();
      if (
        presetRange &&
        value.start &&
        value.end &&
        value.start.getTime() === presetRange.start.getTime() &&
        value.end.getTime() === presetRange.end.getTime()
      ) {
        return preset.id;
      }
    }
    return null;
  }, [value]);

  return (
    <div className="date-range-picker" role="group" aria-label={ariaLabel}>
      {/* From input */}
      <div className="date-range-picker__field">
        <label htmlFor="filter-date-from" className="date-range-picker__label">
          From
        </label>
        <input
          id="filter-date-from"
          type="date"
          className="date-range-picker__input"
          value={formatDateForInput(value?.start)}
          onChange={handleFromChange}
          aria-label="Filter from date"
          placeholder="mm/dd/yyyy"
          data-testid="date-from-input"
        />
      </div>

      {/* To input */}
      <div className="date-range-picker__field">
        <label htmlFor="filter-date-to" className="date-range-picker__label">
          To
        </label>
        <input
          id="filter-date-to"
          type="date"
          className="date-range-picker__input"
          value={formatDateForInput(value?.end)}
          onChange={handleToChange}
          aria-label="Filter to date"
          placeholder="mm/dd/yyyy"
          data-testid="date-to-input"
        />
      </div>

      {/* Presets dropdown */}
      <div className="date-range-picker__presets-wrapper" role="group" aria-label="Date range presets">
        <button
          ref={triggerRef}
          type="button"
          className={`date-range-picker__presets-trigger ${hasActiveRange ? 'date-range-picker__presets-trigger--active' : ''}`}
          onClick={() => setIsPresetsOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={isPresetsOpen}
          aria-label={hasActiveRange ? 'Date range selected. Click to change preset.' : 'Select date range preset'}
          data-testid="date-presets-trigger"
        >
          <svg
            className="date-range-picker__presets-icon"
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
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="date-range-picker__presets-text">
            {activePreset
              ? DATE_PRESETS.find((p) => p.id === activePreset)?.label ?? 'Custom range'
              : 'Date range'}
          </span>
          <svg
            className={`date-range-picker__presets-chevron ${isPresetsOpen ? 'date-range-picker__presets-chevron--open' : ''}`}
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
        </button>

        {isPresetsOpen && (
          <div
            ref={presetsRef}
            className="date-range-picker__presets-menu"
            role="menu"
            aria-label="Date range presets"
          >
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="menuitem"
                className={`date-range-picker__preset-item ${activePreset === preset.id ? 'date-range-picker__preset-item--active' : ''}`}
                onClick={() => handlePresetClick(preset)}
              >
                <span className="date-range-picker__preset-label">{preset.label}</span>
                {activePreset === preset.id && (
                  <svg
                    className="date-range-picker__preset-check"
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
            <div className="date-range-picker__presets-divider" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="date-range-picker__preset-item date-range-picker__preset-item--clear"
              onClick={handleClear}
              disabled={!hasActiveRange}
              data-testid="date-range-clear"
            >
              <span className="date-range-picker__preset-label">Clear range</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}