/**
 * Layout Component
 *
 * Wrapper component providing the main page structure with TopBar and main content area.
 *
 * @module @frontend/components/Layout
 */
import './Layout.css';
interface LayoutProps {
    /** Child content to render in the main area */
    children: React.ReactNode;
    /** Callback when settings should be opened */
    onOpenSettings: () => void;
    /** Callback when show completed toggle changes */
    onToggleShowCompleted: (show: boolean) => void;
}
export declare function Layout({ children, onOpenSettings, onToggleShowCompleted, }: LayoutProps): JSX.Element;
export {};
//# sourceMappingURL=Layout.d.ts.map