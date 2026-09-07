/**
 * AssignmentListPage — Assignment List Page Component
 *
 * Page wrapper for the AssignmentList component with proper page semantics.
 * This is the main landing page showing all assignments.
 *
 * @module @frontend/pages/AssignmentListPage
 */

import { useNavigate } from 'react-router-dom';

import { AssignmentList } from '../components/AssignmentList';
import { FilterBar } from '../components/FilterBar';

interface AssignmentListPageProps {
  /** Optional callback when an assignment is clicked (for future detail view) */
  onAssignmentClick?: (assignment: import('@backend/shared/types').Assignment) => void;
}

/**
 * AssignmentListPage - Main page showing the assignment list.
 * Wraps AssignmentList with page-level semantics and accessibility.
 */
export function AssignmentListPage({
  onAssignmentClick,
}: AssignmentListPageProps): JSX.Element {
  const navigate = useNavigate();

  const handleAssignmentClick = (assignment: import('@backend/shared/types').Assignment) => {
    navigate(`/assignments/${assignment.id}`);
    onAssignmentClick?.(assignment);
  };

  return (
    <section className="assignment-list-page" aria-label="Assignments">
      <FilterBar />
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