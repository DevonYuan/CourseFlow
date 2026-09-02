import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Layout Component
 *
 * Wrapper component providing the main page structure with TopBar and main content area.
 *
 * @module @frontend/components/Layout
 */
import { TopBar } from './TopBar';
import './Layout.css';
export function Layout({ children, onOpenSettings, onToggleShowCompleted, }) {
    return (_jsxs("div", { className: "layout", children: [_jsx(TopBar, { onOpenSettings: onOpenSettings, onToggleShowCompleted: onToggleShowCompleted }), _jsx("main", { className: "layout__main", role: "main", tabIndex: -1, children: _jsx("div", { className: "layout__content", children: children }) })] }));
}
//# sourceMappingURL=Layout.js.map