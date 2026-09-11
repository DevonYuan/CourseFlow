/**
 * localStorage Utilities — Prompt Dismissal Persistence
 *
 * Helper functions for managing dismissed prompt state in localStorage.
 * Keyed by assignment ID to persist dismissal across sessions.
 *
 * @module @frontend/utils/localStorage
 */

/** localStorage key prefix for dismissed all-complete prompts */
const DISMISSED_PROMPT_PREFIX = 'courseflow:dismissedAllCompletePrompt:';

/**
 * Checks if the all-complete prompt has been dismissed for an assignment.
 *
 * @param assignmentId - The assignment ID to check
 * @returns true if dismissed, false otherwise
 */
export function isPromptDismissed(assignmentId: string): boolean {
  try {
    const key = `${DISMISSED_PROMPT_PREFIX}${assignmentId}`;
    const value = localStorage.getItem(key);
    return value === 'true';
  } catch {
    // Ignore errors (private browsing, quota exceeded, etc.)
    return false;
  }
}

/**
 * Sets the dismissed state for the all-complete prompt.
 *
 * @param assignmentId - The assignment ID
 * @param dismissed - Whether the prompt is dismissed
 */
export function setPromptDismissed(assignmentId: string, dismissed: boolean): void {
  try {
    const key = `${DISMISSED_PROMPT_PREFIX}${assignmentId}`;
    if (dismissed) {
      localStorage.setItem(key, 'true');
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore errors (private browsing, quota exceeded, etc.)
  }
}

/**
 * Clears the dismissed state for the all-complete prompt.
 * Called when sub-task state changes (add/delete/toggle incomplete).
 *
 * @param assignmentId - The assignment ID
 */
export function clearPromptDismissed(assignmentId: string): void {
  try {
    const key = `${DISMISSED_PROMPT_PREFIX}${assignmentId}`;
    localStorage.removeItem(key);
  } catch {
    // Ignore errors (private browsing, quota exceeded, etc.)
  }
}
