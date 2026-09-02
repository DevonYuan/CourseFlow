/**
 * EmptyState — Empty State Component for Assignment List
 *
 * Displays when no assignments exist and user hasn't synced yet.
 * Includes illustration, message, and CTA to open Settings modal.
 *
 * @module @frontend/components/EmptyState
 */
import './EmptyState.css';
interface EmptyStateProps {
    /** Callback fired when "Open Settings" button is clicked */
    onOpenSettings: () => void;
    /** Optional custom message (default: "No assignments yet") */
    message?: string;
    /** Optional custom subtext (default: "Add your Canvas iCal URL in Settings to get started") */
    subtext?: string;
    /** Optional custom CTA button text (default: "Open Settings") */
    ctaText?: string;
}
/**
 * Empty state shown when no assignments are available.
 * Friendly, actionable copy with clear CTA to configure iCal URL.
 */
export declare function EmptyState({ onOpenSettings, message, subtext, ctaText, }: EmptyStateProps): JSX.Element;
export {};
//# sourceMappingURL=EmptyState.d.ts.map