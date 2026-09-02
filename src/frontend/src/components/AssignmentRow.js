import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CourseColorBadge } from './CourseColorBadge';
import './AssignmentRow.css';
/**
 * Formats due date as "Mon, Jan 15 • 11:59 PM" in local timezone.
 */
function formatDueDate(dueAt) {
    if (!dueAt)
        return 'No due date';
    const date = new Date(dueAt);
    const day = date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    const time = date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
    });
    return `${day} • ${time}`;
}
const statusLabels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    archived: 'Archived',
};
const statusColors = {
    pending: 'var(--status-pending, #f59e0b)',
    in_progress: 'var(--status-in-progress, #3b82f6)',
    completed: 'var(--status-completed, #10b981)',
    archived: 'var(--status-archived, #9ca3af)',
};
/**
 * Individual assignment row with click/keyboard handling.
 */
export function AssignmentRow({ assignment, onClick, onMarkComplete }) {
    const isOverdue = assignment.dueAt ? new Date(assignment.dueAt) < new Date() : false;
    const dueDate = formatDueDate(assignment.dueAt);
    const isCompleted = assignment.status === 'completed';
    const handleClick = () => {
        if (onClick) {
            onClick(assignment);
        }
    };
    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
        }
    };
    const handleMarkComplete = (event) => {
        // Prevent row click from firing
        event.stopPropagation();
        if (onMarkComplete && !isCompleted) {
            void onMarkComplete(assignment.id);
        }
    };
    const handleMarkCompleteKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            if (onMarkComplete && !isCompleted) {
                void onMarkComplete(assignment.id);
            }
        }
    };
    return (_jsxs("div", { className: `assignment-row${isCompleted ? ' assignment-row--completed' : ''}`, role: "listitem", tabIndex: onClick ? 0 : undefined, onClick: handleClick, onKeyDown: handleKeyDown, style: { '--course-color': assignment.courseColor }, "aria-label": `${assignment.title}, ${assignment.courseName}, due ${dueDate}, ${statusLabels[assignment.status]}`, children: [_jsxs("div", { className: "assignment-row__course", children: [_jsx(CourseColorBadge, { color: assignment.courseColor, variant: "dot", size: 10, ariaLabel: `${assignment.courseName} color` }), _jsx("span", { className: "assignment-row__course-name", children: assignment.courseName })] }), _jsx("div", { className: "assignment-row__title", children: assignment.title }), _jsxs("div", { className: "assignment-row__due", "aria-label": `Due ${dueDate}`, children: [isOverdue && !isCompleted && (_jsx("span", { className: "assignment-row__overdue-badge", "aria-label": "Overdue", children: "!" })), _jsx("time", { dateTime: assignment.dueAt || undefined, children: dueDate })] }), _jsx("div", { className: "assignment-row__status", children: _jsx("span", { className: "assignment-row__badge", style: { backgroundColor: statusColors[assignment.status] }, children: statusLabels[assignment.status] }) }), _jsx("div", { className: "assignment-row__action", children: isCompleted ? (_jsx("span", { className: "assignment-row__completed-icon", "aria-label": "Completed", children: _jsx("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }) })) : (_jsx("button", { type: "button", className: "assignment-row__complete-btn", onClick: handleMarkComplete, onKeyDown: handleMarkCompleteKeyDown, "aria-label": `Mark "${assignment.title}" as complete`, "aria-pressed": false, children: _jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("circle", { cx: "12", cy: "12", r: "10" }) }) })) })] }));
}
//# sourceMappingURL=AssignmentRow.js.map