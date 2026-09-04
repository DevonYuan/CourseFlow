/**
 * PriorityLiveRegion — ARIA Live Region for Priority Changes
 *
 * Announces priority reordering actions to screen readers.
 * Uses polite live region to avoid interrupting current speech.
 *
 * @module @frontend/components/AssignmentList/PriorityLiveRegion
 */

import React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';

import './PriorityLiveRegion.css';

interface PriorityLiveRegionProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * ARIA live region component for announcing priority changes.
 * Provides a callback to trigger announcements.
 */
export function PriorityLiveRegion({ className = '' }: PriorityLiveRegionProps): JSX.Element {
  const [announcement, setAnnouncement] = useState<string>('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear announcement after screen readers have had time to read it
  useEffect(() => {
    if (announcement) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setAnnouncement('');
      }, 1000);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [announcement]);

  // Callback to trigger announcements
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
  }, []);

  // Expose announce function globally for the keyboard hook
  // This is a bit of a hack but works for the pattern where
  // the hook is used in a parent component that can pass the callback
  useEffect(() => {
    (window as unknown as { __priorityAnnounce?: (msg: string) => void }).__priorityAnnounce = announce;
    return () => {
      (window as unknown as { __priorityAnnounce?: (msg: string) => void }).__priorityAnnounce = undefined;
    };
  }, [announce]);

  return (
    <div
      className={`priority-live-region ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-relevant="additions text"
    >
      {announcement}
    </div>
  );
}

/**
 * Hook to get the announce function from the live region.
 * Use this in components that need to trigger announcements.
 */
export function usePriorityAnnounce(): (message: string) => void {
  const announceRef = useRef<(message: string) => void>();

  useEffect(() => {
    announceRef.current = (window as unknown as { __priorityAnnounce?: (msg: string) => void }).__priorityAnnounce;
  }, []);

  return useCallback((message: string) => {
    announceRef.current?.(message);
  }, []);
}