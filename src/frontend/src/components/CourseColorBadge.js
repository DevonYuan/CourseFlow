import { jsx as _jsx } from "react/jsx-runtime";
/**
 * CourseColorBadge — Colored Indicator Component
 *
 * Displays a colored dot/square representing a course color.
 * Used in assignment rows and course headers.
 *
 * @module @frontend/components/CourseColorBadge
 */
import './CourseColorBadge.css';
/**
 * Renders a colored badge for course identification.
 */
export function CourseColorBadge({ color, variant = 'dot', size = 10, ariaLabel, }) {
    const className = `course-color-badge course-color-badge--${variant}`;
    return (_jsx("span", { className: className, style: {
            width: size,
            height: size,
            backgroundColor: color,
            '--badge-size': `${size}px`,
        }, "aria-hidden": !ariaLabel, "aria-label": ariaLabel, role: ariaLabel ? 'img' : undefined }));
}
//# sourceMappingURL=CourseColorBadge.js.map