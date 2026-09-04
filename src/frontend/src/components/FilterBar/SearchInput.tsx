/**
 * SearchInput — Filter Bar Search Component
 *
 * Text input with debounce (300ms), clear button, and accessibility support.
 * Updates the search query filter in the Zustand store.
 *
 * @module @frontend/components/FilterBar/SearchInput
 */

import { useCallback, useEffect, useRef } from 'react';

import { useSetSearchQuery } from '../../store/assignmentsStore';
import { debounce } from '../../utils/debounce';

import './SearchInput.css';

interface SearchInputProps {
  /** Current search query value */
  value: string;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** ARIA label for the input */
  ariaLabel?: string;
}

/**
 * Search input with debounced updates and clear button.
 * Implements accessible search pattern with proper labeling and keyboard support.
 */
export function SearchInput({
  value,
  placeholder = 'Search assignments...',
  debounceMs = 300,
  ariaLabel = 'Search assignments',
}: SearchInputProps): JSX.Element {
  const setSearchQuery = useSetSearchQuery();
  const inputRef = useRef<HTMLInputElement>(null);

  // Create debounced setter once
  const debouncedSetSearchQuery = useRef(
    debounce((query: string) => {
      setSearchQuery(query);
    }, debounceMs)
  ).current;

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSetSearchQuery.cancel();
    };
  }, [debouncedSetSearchQuery]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const query = event.target.value;
      debouncedSetSearchQuery(query);
    },
    [debouncedSetSearchQuery]
  );

  const handleClear = useCallback(() => {
    debouncedSetSearchQuery.cancel();
    setSearchQuery('');
    inputRef.current?.focus();
  }, [debouncedSetSearchQuery, setSearchQuery]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Clear on Escape key
      if (event.key === 'Escape' && value) {
        event.preventDefault();
        handleClear();
      }
    },
    [value, handleClear]
  );

  const handleBlur = useCallback(() => {
    // Flush debounce on blur to ensure final value is persisted
    debouncedSetSearchQuery.flush();
  }, [debouncedSetSearchQuery]);

  return (
    <div className="search-input-wrapper">
      <label htmlFor="filter-search" className="visually-hidden">
        {ariaLabel}
      </label>
      <input
        ref={inputRef}
        id="filter-search"
        type="search"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        aria-label={ariaLabel}
        aria-describedby="search-hint"
        data-testid="search-input"
      />
      {value && (
        <button
          type="button"
          className="search-input__clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <svg
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      <span id="search-hint" className="visually-hidden">
        Type to filter assignments. Press Escape to clear.
      </span>
    </div>
  );
}