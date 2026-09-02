/**
 * AssignmentListSkeleton — Skeleton Loader for Assignment Rows
 *
 * Displays 3-5 animated skeleton rows matching the visual structure
 * of AssignmentRow while data is loading.
 * CSS-only shimmer animation, no JS dependencies.
 *
 * @module @frontend/components/AssignmentListSkeleton
 */
import './AssignmentListSkeleton.css';
interface AssignmentListSkeletonProps {
    /** Number of skeleton rows to show (default: 4) */
    count?: number;
}
/**
 * Skeleton loader for assignment list.
 * Renders configurable number of animated placeholder rows.
 */
export declare function AssignmentListSkeleton({ count }: AssignmentListSkeletonProps): JSX.Element;
export {};
//# sourceMappingURL=AssignmentListSkeleton.d.ts.map