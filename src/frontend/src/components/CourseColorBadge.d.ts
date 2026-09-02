/**
 * CourseColorBadge — Colored Indicator Component
 *
 * Displays a colored dot/square representing a course color.
 * Used in assignment rows and course headers.
 *
 * @module @frontend/components/CourseColorBadge
 */
import './CourseColorBadge.css';
interface CourseColorBadgeProps {
    /** Hex color string (e.g., '#e8a838') */
    color: string;
    /** Badge variant */
    variant?: 'dot' | 'square';
    /** Badge size in pixels */
    size?: number;
    /** Accessible label for the badge */
    ariaLabel?: string;
}
/**
 * Renders a colored badge for course identification.
 */
export declare function CourseColorBadge({ color, variant, size, ariaLabel, }: CourseColorBadgeProps): JSX.Element;
export {};
//# sourceMappingURL=CourseColorBadge.d.ts.map