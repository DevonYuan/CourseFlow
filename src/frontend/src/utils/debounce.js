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
 * @returns Debounced function with cancel and flush methods
 */
export function debounce(func, wait) {
    let timeoutId = null;
    const debounced = (...args) => {
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
            func(...[]);
            timeoutId = null;
        }
    };
    return debounced;
}
//# sourceMappingURL=debounce.js.map