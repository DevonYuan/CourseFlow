/**
 * AssignmentList — Main Assignment List Component
 *
 * Displays assignments with loading skeleton, empty state, and error handling.
 * Uses Zustand store for state management and react-window for virtualization.
 *
 * @module @frontend/components/AssignmentList
 */
import type { Assignment } from '@backend/shared/types';
import './AssignmentList.css';
interface AssignmentListProps {
    /** Callback fired when user clicks "Open Settings" from empty state */
    onOpenSettings: () => void;
    /** Optional callback when an assignment is clicked */
    onAssignmentClick?: (assignment: Assignment) => void;
}
/**
 * Main assignment list component with full state handling:
 * - Skeleton loaders while fetching
 * - Empty state with CTA to Settings
 * - Error state with retry button
 * - Assignment rows when data available (virtualized if > 100)
 */
export declare function AssignmentList({ onOpenSettings, onAssignmentClick }: AssignmentListProps): JSX.Element;
export {};
//# sourceMappingURL=AssignmentList.d.ts.map