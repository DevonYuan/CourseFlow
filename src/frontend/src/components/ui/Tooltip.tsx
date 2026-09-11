/**
 * Tooltip Component
 *
 * Accessible tooltip that shows on hover or focus.
 * Renders as a portal to document.body.
 *
 * @module @frontend/components/ui/Tooltip
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

import './Tooltip.css';

export interface TooltipProps {
  /** Content to display in the tooltip */
  content: string | React.ReactNode;
  /** Child element to attach tooltip to */
  children: React.ReactElement;
  /** Tooltip position: 'top', 'bottom', 'left', 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay in milliseconds before showing */
  delay?: number;
}

/**
 * Tooltip - Accessible tooltip component.
 * - Shows on hover with configurable delay
 * - Shows on focus for keyboard accessibility
 * - Dismisses on Escape key or mouse leave
 * - Renders as portal to body
 */
export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 0,
}: TooltipProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const showTooltip = useCallback(() => {
    clearTimer();
    timeoutRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setTriggerRect(rect);
        setIsOpen(true);
      }
    }, delay);
  }, [clearTimer, delay]);

  const hideTooltip = useCallback(() => {
    clearTimer();
    setIsOpen(false);
  }, [clearTimer]);

  // Handle mouse enter/leave
  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    trigger.addEventListener('mouseenter', showTooltip);
    trigger.addEventListener('mouseleave', hideTooltip);

    return () => {
      trigger.removeEventListener('mouseenter', showTooltip);
      trigger.removeEventListener('mouseleave', hideTooltip);
    };
  }, [showTooltip, hideTooltip]);

  // Handle keyboard focus/blur for accessibility
  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    trigger.addEventListener('focus', showTooltip);
    trigger.addEventListener('blur', hideTooltip);

    return () => {
      trigger.removeEventListener('focus', showTooltip);
      trigger.removeEventListener('blur', hideTooltip);
    };
  }, [showTooltip, hideTooltip]);

  // Handle Escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        hideTooltip();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hideTooltip, isOpen]);

  // Calculate tooltip position
  const getPosition = (): React.CSSProperties => {
    if (!triggerRect) return { opacity: 0, visibility: 'hidden' };

    const tooltipWidth = 200; // Approximate width
    const tooltipHeight = 40; // Approximate height
    const arrowHeight = 6;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top': {
        top = triggerRect.top - tooltipHeight - arrowHeight;
        left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
        break;
      }
      case 'bottom': {
        top = triggerRect.bottom + arrowHeight;
        left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
        break;
      }
      case 'left': {
        top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
        left = triggerRect.left - tooltipWidth - arrowHeight;
        break;
      }
      case 'right': {
        top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
        left = triggerRect.right + arrowHeight;
        break;
      }
    }

    // Ensure tooltip stays within viewport
    left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
    top = Math.max(10, Math.min(top, window.innerHeight - tooltipHeight - 10));

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  };

  if (!isOpen || !triggerRect) {
    return children;
  }

  const tooltipElement = (
    <div
      ref={tooltipRef}
      className="tooltip"
      style={getPosition()}
      role="tooltip"
      aria-hidden={!isOpen}
    >
      {content}
      <div className={`tooltip__arrow tooltip__arrow--${position}`} />
    </div>
  );

  return createPortal(tooltipElement, document.body);
}

/**
 * TooltipWrap - Wrapper component that adds tooltip to any element.
 * Use when you need to wrap text inside a label or span.
 */
export interface TooltipWrapProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
}

export function TooltipWrap({ content, children }: TooltipWrapProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const show = () => {
      clearTimer();
      timeoutRef.current = window.setTimeout(() => {
        if (trigger) {
          setTriggerRect(trigger.getBoundingClientRect());
          setIsOpen(true);
        }
      }, 100);
    };

    const hide = () => {
      clearTimer();
      setIsOpen(false);
    };

    trigger.addEventListener('mouseenter', show);
    trigger.addEventListener('mouseleave', hide);
    trigger.addEventListener('focus', show);
    trigger.addEventListener('blur', hide);

    return () => {
      trigger.removeEventListener('mouseenter', show);
      trigger.removeEventListener('mouseleave', hide);
      trigger.removeEventListener('focus', show);
      trigger.removeEventListener('blur', hide);
    };
  }, [clearTimer]);

  // Simple implementation without portal for inline text
  if (!isOpen || !triggerRect) {
    return (
      <span
        ref={triggerRef}
        className="tooltip-trigger"
        tabIndex={0}
        aria-describedby="tooltip-content"
        style={{ cursor: 'help' }}
      >
        {children}
      </span>
    );
  }

  return (
    <span className="tooltip-wrapper">
      <span
        ref={triggerRef}
        className="tooltip-trigger"
        tabIndex={0}
        aria-describedby="tooltip-content"
        style={{ cursor: 'help' }}
      >
        {children}
      </span>
      <span
        id="tooltip-content"
        className="tooltip-wrapper__tooltip"
        style={{ top: '100%', left: '0' }}
      >
        {content}
      </span>
    </span>
  );
}
