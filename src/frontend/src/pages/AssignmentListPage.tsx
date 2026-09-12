/**
 * AssignmentListPage — Assignment List Page Component
 *
 * Page wrapper for the AssignmentList component with proper page semantics.
 * This is the main landing page showing all assignments.
 * FilterBar removed - filters are now in the Toolbar (Layout component).
 *
 * @module @frontend/pages/AssignmentListPage
 */

import type { Assignment } from '@backend/shared/types';
import { useNavigate } from 'react-router-dom';

import { AssignmentList } from '../components/AssignmentList';
import { useFocusRestorationContext } from '../context/FocusRestorationContext';

interface AssignmentListPageProps {
  /** Optional callback when an assignment is clicked (for future detail view) */
  onAssignmentClick?: (assignment: Assignment) => void;
}

/**
 * AssignmentListPage - Main page showing the assignment list.
 * Wraps AssignmentList with page-level semantics and accessibility.
 */
export function AssignmentListPage({ onAssignmentClick }: AssignmentListPageProps): JSX.Element {
  const navigate = useNavigate();
  const { saveFocus } = useFocusRestorationContext();

  const handleAssignmentClick = (assignment: Assignment) => {
    // Save focus on the row before navigating
    saveFocus();
    void navigate(`/assignments/${assignment.id}`);
    onAssignmentClick?.(assignment);
  };

  return (
    <section className="assignment-list-page" aria-label="Assignments">
      <AssignmentList
        onOpenSettings={() => {
          // Navigation to settings is handled by the TopBar settings button
          // This is a fallback - in practice, the TopBar handles this
          window.location.href = '/settings';
        }}
        onAssignmentClick={handleAssignmentClick}
      />
    </section>
  );
}
