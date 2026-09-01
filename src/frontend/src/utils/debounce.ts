/**
 * Debounce Utility
 *
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @module @frontend/utils/debounce
 */

/**
 * Creates a debounced version of a function.
 *
 * @template T - Function type
 * @param func - Function to debounce
 * @param wait - Milliseconds to wait before invoking
 * @returns Debounced function with same signature
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };

  // Attach cancel method for cleanup
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  // Attach flush method for immediate execution
  debounced.flush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      func(...[] as unknown as Parameters<T>);
      timeoutId = null;
    }
  };

  return debounced;
}