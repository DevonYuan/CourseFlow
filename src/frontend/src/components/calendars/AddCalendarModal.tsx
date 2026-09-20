/**
 * AddCalendarModal — Modal for Adding/Editing Calendar Sources
 *
 * Form with name input, iCal URL input (with validation), and color picker
 * (12-color palette + custom color input). Integrates with calendarsStore
 * for optimistic create/update.
 *
 * @module @frontend/components/calendars/AddCalendarModal
 */

import type { CalendarSource, CalendarSourceInput, CalendarSourceUpdateInput } from '@backend/shared/types';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useToast } from '../../context/ToastContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useCalendarsStore } from '../../stores/calendarsStore';

import './AddCalendarModal.css';

/**
 * Predefined color palette (12 colors matching course colors).
 */
const COLOR_PALETTE = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#a855f7', // Purple
];

/** Fallback when the palette is ever empty (also satisfies noUncheckedIndexedAccess). */
const DEFAULT_CALENDAR_COLOR = '#3b82f6';

interface AddCalendarModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Calendar to edit (null for create) */
  calendar: CalendarSource | null;
  /** Callback when modal closes */
  onClose: () => void;
}

/**
 * CalendarForm — Form fields for calendar name, URL, and color.
 */
function CalendarForm({
  initialName,
  initialUrl,
  initialColor,
  onSubmit,
  isSubmitting,
  onCancel,
}: {
  initialName: string;
  initialUrl: string;
  initialColor: string;
  onSubmit: (data: { name: string; feedUrl: string; color: string }) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
}): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [feedUrl, setFeedUrl] = useState(initialUrl);
  const [color, setColor] = useState(initialColor);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const customColorRef = useRef<HTMLInputElement>(null);

  // Focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const validateUrl = useCallback((url: string): boolean => {
    if (!url.trim()) {
      setUrlError('iCal URL is required');
      return false;
    }
    try {
      new URL(url);
      setUrlError(null);
      return true;
    } catch {
      setUrlError('Invalid URL format');
      return false;
    }
  }, []);

  const validateName = useCallback((nameValue: string): boolean => {
    if (!nameValue.trim()) {
      setNameError('Name is required');
      return false;
    }
    if (nameValue.trim().length > 100) {
      setNameError('Name must be 100 characters or less');
      return false;
    }
    setNameError(null);
    return true;
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateName(name) || !validateUrl(feedUrl)) {
      return;
    }

    void onSubmit({ name: name.trim(), feedUrl: feedUrl.trim(), color });
  };

  const handleColorSelect = (selectedColor: string) => {
    setColor(selectedColor);
  };

  return (
    <form onSubmit={handleSubmit} className="calendar-form" noValidate>
      {/* Name Field */}
      <div className="form-group">
        <label htmlFor="calendar-name">Calendar Name <span className="required">*</span></label>
        <input
          ref={nameInputRef}
          id="calendar-name"
          type="text"
          placeholder="e.g., School, Personal, Birthdays"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) validateName(e.target.value);
          }}
          onBlur={() => validateName(name)}
          disabled={isSubmitting}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'name-error' : 'name-help'}
          maxLength={100}
          autoComplete="off"
          data-testid="calendar-name-input"
        />
        {nameError && (
          <small id="name-error" className="error-text" role="alert">
            {nameError}
          </small>
        )}
        <small id="name-help" className="help-text">
          A display name for this calendar source
        </small>
      </div>

      {/* iCal URL Field */}
      <div className="form-group">
        <label htmlFor="calendar-url">iCal URL <span className="required">*</span></label>
        <input
          ref={urlInputRef}
          id="calendar-url"
          type="url"
          placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
          value={feedUrl}
          onChange={(e) => {
            setFeedUrl(e.target.value);
            if (urlError) validateUrl(e.target.value);
          }}
          onBlur={() => validateUrl(feedUrl)}
          disabled={isSubmitting}
          aria-invalid={!!urlError}
          aria-describedby={urlError ? 'url-error' : 'url-help'}
          autoComplete="off"
          data-testid="calendar-url-input"
        />
        {urlError && (
          <small id="url-error" className="error-text" role="alert">
            {urlError}
          </small>
        )}
        <small id="url-help" className="help-text">
          Paste any iCal feed URL (Google Calendar, Canvas, Outlook, etc.)
        </small>
      </div>

      {/* Color Picker */}
      <div className="form-group">
        <label htmlFor="calendar-color">Color <span className="required">*</span></label>
        <div className="calendar-color-picker">
          {/* Predefined color palette */}
          <fieldset className="color-palette">
            <legend className="visually-hidden">Select a color</legend>
            {COLOR_PALETTE.map((paletteColor) => (
              <button
                key={paletteColor}
                type="button"
                className={`color-swatch ${color === paletteColor ? 'color-swatch--selected' : ''}`}
                style={{ backgroundColor: paletteColor }}
                onClick={() => handleColorSelect(paletteColor)}
                aria-label={`Select color ${paletteColor}`}
                aria-pressed={color === paletteColor}
                disabled={isSubmitting}
                data-testid={`color-swatch-${paletteColor}`}
              >
                {color === paletteColor && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </fieldset>

          {/* Custom color input */}
          <div className="custom-color">
            <label htmlFor="calendar-custom-color" className="custom-color__label">
              Custom color
            </label>
            <input
              ref={customColorRef}
              id="calendar-custom-color"
              type="color"
              value={color}
              onChange={(e) => handleColorSelect(e.target.value)}
              disabled={isSubmitting}
              className="custom-color__input"
              aria-label="Custom color picker"
              data-testid="calendar-custom-color-input"
            />
            <span className="custom-color__preview" style={{ backgroundColor: color }} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="modal-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
          data-testid="calendar-form-cancel"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="primary"
          disabled={isSubmitting}
          data-testid="calendar-form-submit"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

/**
 * AddCalendarModal — Modal wrapper with focus trap and portal rendering.
 */
export function AddCalendarModal({ open, calendar, onClose }: AddCalendarModalProps): React.ReactPortal | null {
  const { optimisticCreate, optimisticUpdate } = useCalendarsStore();
  const { success: toastSuccess, error: toastError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isEditing = calendar !== null;

  // Use focus trap for accessibility
  const containerRef = useFocusTrap({
    isActive: open,
    onEscape: onClose,
    initialFocusRef: isEditing ? submitButtonRef : cancelButtonRef,
  });

  // Reset form when opening/closing
  useEffect(() => {
    if (open) {
      // Component will re-render with new calendar prop
    }
  }, [open, calendar]);

  const handleSubmit = useCallback(
    async (data: { name: string; feedUrl: string; color: string }) => {
      setIsSubmitting(true);
      try {
        if (isEditing && calendar) {
          // Update existing calendar
          const updateInput: CalendarSourceUpdateInput = {
            id: calendar.id,
            name: data.name,
            feedUrl: data.feedUrl,
            color: data.color,
          };
          await optimisticUpdate(updateInput);
          toastSuccess('Calendar updated');
        } else {
          // Create new calendar
          const createInput: CalendarSourceInput = {
            name: data.name,
            feedUrl: data.feedUrl,
            color: data.color,
            enabled: true,
          };
          await optimisticCreate(createInput);
          toastSuccess('Calendar added');
        }
        onClose();
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to save calendar');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isEditing, calendar, optimisticCreate, optimisticUpdate, toastSuccess, toastError, onClose]
  );

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  const initialName = calendar?.name ?? '';
  const initialUrl = calendar ? '' : ''; // Don't show decrypted URL for security
  const initialColor = calendar?.color ?? COLOR_PALETTE[0] ?? DEFAULT_CALENDAR_COLOR;

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={containerRef}
        className="modal modal--calendar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-modal-title"
      >
        <div className="modal-header">
          <h2 id="calendar-modal-title" className="modal__title">
            {isEditing ? 'Edit Calendar' : 'Add Calendar'}
          </h2>
          <button
            className="close-button"
            onClick={onClose}
            aria-label={isEditing ? 'Close edit calendar' : 'Close add calendar'}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="modal-content">
          <CalendarForm
            initialName={initialName}
            initialUrl={initialUrl}
            initialColor={initialColor}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Named export only - default export not used per project conventions