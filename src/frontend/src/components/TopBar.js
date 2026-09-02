import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * TopBar Component
 *
 * Fixed header with app title, sync status, show completed toggle, and settings button.
 *
 * @module @frontend/components/TopBar
 */
import { useSettings } from '../hooks/useSettings';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import './TopBar.css';
export function TopBar({ onOpenSettings, onToggleShowCompleted }) {
    const { settings, isLoading } = useSettings();
    const handleToggleChange = (event) => {
        onToggleShowCompleted(event.target.checked);
    };
    if (isLoading || !settings) {
        return (_jsx("header", { className: "top-bar", role: "banner", children: _jsxs("div", { className: "top-bar__inner", children: [_jsx("h1", { className: "top-bar__title", children: "CourseFlow" }), _jsx("div", { className: "top-bar__center", "aria-busy": "true", children: _jsx("span", { className: "top-bar__loading", children: "Loading..." }) }), _jsx("div", { className: "top-bar__actions" })] }) }));
    }
    return (_jsx("header", { className: "top-bar", role: "banner", children: _jsxs("div", { className: "top-bar__inner", children: [_jsx("h1", { className: "top-bar__title", children: _jsx("a", { href: "/", className: "top-bar__title-link", onClick: (e) => e.preventDefault(), children: "CourseFlow" }) }), _jsx("nav", { className: "top-bar__center", "aria-label": "Sync status", children: _jsx(SyncStatusIndicator, {}) }), _jsxs("div", { className: "top-bar__actions", children: [_jsxs("label", { className: "top-bar__toggle", htmlFor: "show-completed", children: [_jsx("input", { type: "checkbox", id: "show-completed", checked: settings.showCompletedAssignments, onChange: handleToggleChange, className: "top-bar__toggle-input", "aria-label": "Show completed assignments" }), _jsx("span", { className: "top-bar__toggle-text", children: "Show Completed" })] }), _jsx("button", { className: "top-bar__settings-btn", onClick: onOpenSettings, "aria-label": "Open settings", type: "button", children: _jsxs("svg", { className: "top-bar__settings-icon", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" })] }) })] })] }) }));
}
//# sourceMappingURL=TopBar.js.map