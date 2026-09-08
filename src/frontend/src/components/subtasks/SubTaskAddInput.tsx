/**
 * SubTaskAddInput — Add Sub-task Input Component
 *
 * Inline input for adding new sub-tasks. Enter to save, Escape to clear.
 * Validates: non-empty, max 200 chars. Auto-focuses on mount.
 *
 * @module @frontend/components/subtasks/SubTaskAddInput
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface SubTaskAddInputProps {
  /** Callback when a new sub-task title is submitted */
  onAdd: (title: string) => void;
  /** Whether the input is disabled (e.g., during loading) */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

/**
 * SubTaskAddInput - Input field for adding sub-tasks.
 * - Enter: submits (if valid)
 * - Escape: clears input
 * - Auto-focuses on mount
 * - Validates: non-empty, max 200 chars
 */
export function SubTaskAddInput({
  onAdd,
  disabled = false,
  placeholder = 'Add a sub-task...',
}: SubTaskAddInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const MAX_LENGTH = 200;

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (error) setError(null);
  }, [error]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) {
          setError('Sub-task title cannot be empty');
          return;
        }
        if (trimmed.length > MAX_LENGTH) {
          setError(`Title must be ${MAX_LENGTH} characters or less`);
          return;
        }
        onAdd(trimmed);
        setValue('');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setValue('');
        setError(null);
        inputRef.current?.blur();
      }
    },
    [value, onAdd]
  );

  const handleBlur = useCallback(() => {
    // Clear error on blur if user clicks away
    if (error && !value.trim()) {
      setError(null);
    }
  }, [error, value]);

  return (
    <div className="subtask-add-input">
      <form className="subtask-add-input__form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="subtask-add-input" className="visually-hidden">
          Add sub-task
        </label>
        <input
          ref={inputRef}
          id="subtask-add-input"
          type="text"
          className={`subtask-add-input__input${error ? ' subtask-add-input__input--error' : ''}`}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={MAX_LENGTH}
          aria-label="Add sub-task"
          aria-invalid={!!error}
          aria-describedby={error ? 'subtask-add-error' : undefined}
          autoComplete="off"
        />
        {error && (
          <span id="subtask-add-error" className="subtask-add-input__error" role="alert">
            {error}
          </span>
        )}
      </form>
    </div>
  );
}