import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * AssignmentList — Main Assignment List Component
 *
 * Displays assignments with loading skeleton, empty state, and error handling.
 * Uses Zustand store for state management and react-window for virtualization.
 *
 * @module @frontend/components/AssignmentList
 */
import { useEffect, useMemo } from 'react';
import { List } from 'react-window';
import { AssignmentListSkeleton } from './AssignmentListSkeleton';
import { EmptyState } from './EmptyState';
import { AssignmentRow } from './AssignmentRow';
import { useAssignmentsStore, useAssignments, useAssignmentsLoading, useAssignmentsError, useAssignmentsEmpty, initializeAssignmentsStore, } from '../store/assignmentsStore';
import { useAssignments as useAssignmentsHook } from '../hooks/useAssignments';
import './AssignmentList.css';
// Virtualization threshold - use virtualized list when > 100 items
const VIRTUALIZATION_THRESHOLD = 100;
// Estimated row height for virtualization
const ROW_HEIGHT = 72;
/**
 * Row renderer for react-window FixedSizeList.
 */
function AssignmentRowRenderer(props) {
    const { index, style, assignments, onClick, onMarkComplete, ...rest } = props;
    const assignment = assignments[index];
    // react-window only calls renderer with valid indices, but TypeScript needs assurance
    if (!assignment) {
        return _jsx("div", { style: style, ...rest });
    }
    return (_jsx("div", { style: style, ...rest, children: _jsx(AssignmentRow, { assignment: assignment, onClick: onClick, onMarkComplete: onMarkComplete }) }));
}
/**
 * Main assignment list component with full state handling:
 * - Skeleton loaders while fetching
 * - Empty state with CTA to Settings
 * - Error state with retry button
 * - Assignment rows when data available (virtualized if > 100)
 */
export function AssignmentList({ onOpenSettings, onAssignmentClick }) {
    // Initialize store on first mount
    useEffect(() => {
        const cleanup = initializeAssignmentsStore();
        return cleanup;
    }, []);
    // Select state from Zustand store
    const assignments = useAssignments();
    const isLoading = useAssignmentsLoading();
    const error = useAssignmentsError();
    const isEmpty = useAssignmentsEmpty();
    // Get markComplete from hook
    const { markComplete } = useAssignmentsHook();
    // Memoize refetch and clearError from store actions
    const refetch = useMemo(() => useAssignmentsStore.getState().fetchAssignments, []);
    const clearError = useMemo(() => useAssignmentsStore.getState().clearError, []);
    // Show skeleton while loading
    if (isLoading) {
        return _jsx(AssignmentListSkeleton, { count: 4 });
    }
    // Show error state when fetch failed
    if (error) {
        return (_jsxs("div", { className: "assignment-list__error", role: "alert", "aria-live": "assertive", children: [_jsxs("div", { className: "error-banner", children: [_jsx("div", { className: "error-banner__icon", "aria-hidden": "true", children: _jsxs("svg", { viewBox: "0 0 24 24", width: "24", height: "24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })] }) }), _jsxs("div", { className: "error-banner__content", children: [_jsx("p", { className: "error-banner__message", children: error }), _jsxs("div", { className: "error-banner__actions", children: [_jsx("button", { className: "error-banner__retry", onClick: () => {
                                                clearError();
                                                void refetch();
                                            }, type: "button", children: "Retry" }), _jsx("button", { className: "error-banner__dismiss", onClick: () => {
                                                clearError();
                                            }, type: "button", children: "Dismiss" })] })] })] }), assignments.length > 0 && (_jsx("div", { className: "assignment-list__rows", role: "list", "aria-label": "Assignments", children: assignments.length > VIRTUALIZATION_THRESHOLD ? (_jsx(VirtualizedAssignmentList, { assignments: assignments, onAssignmentClick: onAssignmentClick, onMarkComplete: markComplete })) : (assignments.map((assignment) => (_jsx(AssignmentRow, { assignment: assignment, onClick: onAssignmentClick, onMarkComplete: markComplete }, assignment.id)))) }))] }));
    }
    // Show assignments list
    return (_jsx("div", { className: "assignment-list", role: "list", "aria-label": "Assignments", children: assignments.length === 0 ? (_jsx(EmptyState, { onOpenSettings: onOpenSettings })) : assignments.length > VIRTUALIZATION_THRESHOLD ? (_jsx(VirtualizedAssignmentList, { assignments: assignments, onAssignmentClick: onAssignmentClick, onMarkComplete: markComplete })) : (assignments.map((assignment) => (_jsx(AssignmentRow, { assignment: assignment, onClick: onAssignmentClick, onMarkComplete: markComplete }, assignment.id)))) }));
}
/**
 * Virtualized assignment list using react-window.
 * Only renders visible rows for performance with large lists.
 */
function VirtualizedAssignmentList({ assignments, onAssignmentClick, onMarkComplete, }) {
    const itemData = useMemo(() => ({ assignments, onClick: onAssignmentClick, onMarkComplete }), [assignments, onAssignmentClick, onMarkComplete]);
    return (_jsx(List, { className: "assignment-list__virtualized", style: { height: 600, width: '100%' }, rowCount: assignments.length, rowHeight: ROW_HEIGHT, rowProps: itemData, role: "list", "aria-label": "Assignments", rowComponent: AssignmentRowRenderer }));
}
//# sourceMappingURL=AssignmentList.js.map