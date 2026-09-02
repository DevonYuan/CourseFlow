import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * EmptyState — Empty State Component for Assignment List
 *
 * Displays when no assignments exist and user hasn't synced yet.
 * Includes illustration, message, and CTA to open Settings modal.
 *
 * @module @frontend/components/EmptyState
 */
import './EmptyState.css';
/**
 * Empty state shown when no assignments are available.
 * Friendly, actionable copy with clear CTA to configure iCal URL.
 */
export function EmptyState({ onOpenSettings, message = 'No assignments yet', subtext = 'Add your Canvas iCal URL in Settings to get started', ctaText = 'Open Settings', }) {
    return (_jsxs("div", { className: "empty-state", role: "status", "aria-live": "polite", children: [_jsx("div", { className: "empty-state__illustration", "aria-hidden": "true", "data-testid": "empty-state-illustration", children: _jsxs("svg", { viewBox: "0 0 120 120", width: "80", height: "80", fill: "none", xmlns: "http://www.w3.org/2000/svg", role: "img", "aria-label": "Calendar with checkmark", children: [_jsx("rect", { x: "15", y: "25", width: "90", height: "70", rx: "8", stroke: "currentColor", strokeWidth: "2" }), _jsx("rect", { x: "15", y: "25", width: "90", height: "22", rx: "8", fill: "currentColor", fillOpacity: "0.15" }), _jsx("rect", { x: "25", y: "30", width: "18", height: "12", rx: "2", fill: "currentColor", fillOpacity: "0.3" }), _jsx("rect", { x: "48", y: "30", width: "24", height: "12", rx: "2", fill: "currentColor", fillOpacity: "0.3" }), _jsx("rect", { x: "77", y: "30", width: "18", height: "12", rx: "2", fill: "currentColor", fillOpacity: "0.3" }), _jsxs("g", { stroke: "currentColor", strokeWidth: "1.5", fill: "none", opacity: "0.4", children: [_jsx("line", { x1: "30", y1: "55", x2: "90", y2: "55" }), _jsx("line", { x1: "30", y1: "65", x2: "90", y2: "65" }), _jsx("line", { x1: "30", y1: "75", x2: "90", y2: "75" }), _jsx("line", { x1: "40", y1: "55", x2: "40", y2: "85" }), _jsx("line", { x1: "55", y1: "55", x2: "55", y2: "85" }), _jsx("line", { x1: "70", y1: "55", x2: "70", y2: "85" }), _jsx("line", { x1: "85", y1: "55", x2: "85", y2: "85" })] }), _jsx("path", { d: "M43 68 L50 75 L62 58", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", fill: "none", opacity: "0.8" })] }) }), _jsx("h2", { className: "empty-state__message", children: message }), _jsx("p", { className: "empty-state__subtext", children: subtext }), _jsx("button", { className: "empty-state__cta", onClick: onOpenSettings, type: "button", "aria-label": ctaText, children: ctaText })] }));
}
//# sourceMappingURL=EmptyState.js.map