/**
 * SyncStatusIndicator Component
 *
 * Displays sync status: last sync time, next auto-sync time,
 * and a manual sync button.
 *
 * @module @frontend/components/SyncStatusIndicator
 */
import './SyncStatusIndicator.css';
interface SyncStatusIndicatorProps {
    /** Callback when manual sync is triggered */
    onSync?: () => void;
}
export declare function SyncStatusIndicator({ onSync }: SyncStatusIndicatorProps): JSX.Element;
export {};
//# sourceMappingURL=SyncStatusIndicator.d.ts.map