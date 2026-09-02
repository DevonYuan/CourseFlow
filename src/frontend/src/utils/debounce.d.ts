/**
 * Debounce Utility
 *
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @module @frontend/utils/debounce
 */
/**
 * Debounced function with cancel and flush methods.
 */
export interface DebouncedFunction<T extends (...args: Parameters<T>) => ReturnType<T>> {
    (...args: Parameters<T>): void;
    cancel: () => void;
    flush: () => void;
}
/**
 * Creates a debounced version of a function.
 *
 * @template T - Function type
 * @param func - Function to debounce
 * @param wait - Milliseconds to wait before invoking
 * @returns Debounced function with cancel and flush methods
 */
export declare function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(func: T, wait: number): DebouncedFunction<T>;
//# sourceMappingURL=debounce.d.ts.map