/**
 * AssignmentRow — Individual Assignment Row Component
 *
 * Displays a single assignment with course color, title, due date, and status.
 * Supports keyboard navigation and click handling.
 *
 * @module @frontend/components/AssignmentRow
 */
import type { Assignment } from '@backend/shared/types';
import './AssignmentRow.css';
interface AssignmentRowProps {
    /** Assignment data to display */
    assignment: Assignment;
    /** Callback when row is clicked */
    onClick?: (assignment: Assignment) => void;
    /** Callback when mark complete is triggered */
    onMarkComplete?: (id: string) => Promise<void>;
}
/**
 * Individual assignment row with click/keyboard handling.
 */
export declare function AssignmentRow({ assignment, onClick, onMarkComplete }: AssignmentRowProps): JSX.Element;
export {};
//# sourceMappingURL=AssignmentRow.d.ts.map