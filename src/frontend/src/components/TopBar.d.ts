/**
 * TopBar Component
 *
 * Fixed header with app title, sync status, show completed toggle, and settings button.
 *
 * @module @frontend/components/TopBar
 */
import './TopBar.css';
interface TopBarProps {
    /** Callback when settings button is clicked */
    onOpenSettings: () => void;
    /** Callback when show completed toggle changes */
    onToggleShowCompleted: (show: boolean) => void;
}
export declare function TopBar({ onOpenSettings, onToggleShowCompleted }: TopBarProps): JSX.Element;
export {};
//# sourceMappingURL=TopBar.d.ts.map