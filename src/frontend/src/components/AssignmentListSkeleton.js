import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * AssignmentListSkeleton — Skeleton Loader for Assignment Rows
 *
 * Displays 3-5 animated skeleton rows matching the visual structure
 * of AssignmentRow while data is loading.
 * CSS-only shimmer animation, no JS dependencies.
 *
 * @module @frontend/components/AssignmentListSkeleton
 */
import './AssignmentListSkeleton.css';
/**
 * Skeleton loader for assignment list.
 * Renders configurable number of animated placeholder rows.
 */
export function AssignmentListSkeleton({ count = 4 }) {
    const rows = Array.from({ length: count }, (_, i) => i);
    return (_jsx("div", { className: "assignment-list-skeleton", role: "status", "aria-live": "polite", "aria-label": "Loading assignments", children: rows.map((index) => (_jsxs("div", { className: "skeleton-row", "data-testid": "skeleton-row", children: [_jsxs("div", { className: "skeleton-cell skeleton-course", children: [_jsx("span", { className: "skeleton-dot", "aria-hidden": "true" }), _jsx("div", { className: "skeleton-text skeleton-course-name", "aria-hidden": "true" })] }), _jsx("div", { className: "skeleton-cell skeleton-title", children: _jsx("div", { className: "skeleton-text skeleton-title-text", "aria-hidden": "true" }) }), _jsx("div", { className: "skeleton-cell skeleton-due", children: _jsx("div", { className: "skeleton-text skeleton-due-text", "aria-hidden": "true" }) }), _jsx("div", { className: "skeleton-cell skeleton-status", children: _jsx("div", { className: "skeleton-badge", "aria-hidden": "true" }) })] }, index))) }));
}
//# sourceMappingURL=AssignmentListSkeleton.js.map