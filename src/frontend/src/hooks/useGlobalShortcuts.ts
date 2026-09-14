/**
 * useGlobalShortcuts — Global keyboard shortcut registration
 *
 * Registers Cmd+K (Mac) / Ctrl+K (Win/Linux) to open the page search palette
 * from anywhere in the app. The shortcut is suppressed while the focus is in
 * a text input, textarea, select, or contenteditable element so it never
 * stomps on the user's typing (including the palette's own input).
 *
 * @module @frontend/hooks/useGlobalShortcuts
 */

import { useEffect } from 'react';

import { useSearchPaletteStore } from '../stores/searchPaletteStore';

/**
 * Returns true when the event target is a text-editing element. Used to keep
 * Cmd+K from firing while the user is typing somewhere.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT'
  );
}

/**
 * Hook that binds the global "open search" shortcut while mounted.
 * The component that uses it should remain mounted for the app's lifetime
 * (e.g. the search palette itself), so the listener is always active.
 */
export function useGlobalShortcuts(): void {
  const open = useSearchPaletteStore((s) => s.open);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'k') return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      open();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);
}