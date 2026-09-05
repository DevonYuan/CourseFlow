/**
 * Theme utilities
 *
 * The UI (CSS) keys off a `light` / `dark` class on the <html> element.
 * This module is the single place that resolves and applies a theme choice,
 * so app startup and the settings modal stay consistent.
 */

export type Theme = 'light' | 'dark' | 'system';

/**
 * Apply a theme choice to the document element by adding a `light` or `dark`
 * class. For `system`, resolve the OS colour-scheme via matchMedia.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');

  let resolved: Exclude<Theme, 'system'>;
  if (theme === 'system') {
    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    resolved = mediaQuery?.matches ? 'dark' : 'light';
  } else {
    resolved = theme;
  }

  root.classList.add(resolved);
  root.dataset['theme'] = resolved;
}