import { jsx as _jsx } from "react/jsx-runtime";
/**
 * AssignmentListSkeleton Tests
 *
 * Tests for the skeleton loader component.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AssignmentListSkeleton } from '../components/AssignmentListSkeleton';
describe('AssignmentListSkeleton', () => {
    it('renders default 4 skeleton rows', () => {
        render(_jsx(AssignmentListSkeleton, {}));
        const rows = screen.getAllByRole('status');
        expect(rows).toHaveLength(1); // One container with role="status"
        const skeletonRows = screen.getAllByTestId('skeleton-row');
        expect(skeletonRows).toHaveLength(4);
    });
    it('renders custom count of skeleton rows', () => {
        render(_jsx(AssignmentListSkeleton, { count: 3 }));
        const skeletonRows = screen.getAllByTestId('skeleton-row');
        expect(skeletonRows).toHaveLength(3);
    });
    it('renders 5 skeleton rows when count is 5', () => {
        render(_jsx(AssignmentListSkeleton, { count: 5 }));
        const skeletonRows = screen.getAllByTestId('skeleton-row');
        expect(skeletonRows).toHaveLength(5);
    });
    it('has proper ARIA attributes for loading state', () => {
        render(_jsx(AssignmentListSkeleton, {}));
        const container = screen.getByRole('status');
        expect(container).toHaveAttribute('aria-live', 'polite');
        expect(container).toHaveAttribute('aria-label', 'Loading assignments');
    });
    it('each row has course, title, due, and status skeleton cells', () => {
        render(_jsx(AssignmentListSkeleton, { count: 1 }));
        const row = screen.getByTestId('skeleton-row');
        expect(row).toHaveClass('skeleton-row');
        // Check for skeleton elements
        expect(row.querySelector('.skeleton-course')).toBeInTheDocument();
        expect(row.querySelector('.skeleton-title')).toBeInTheDocument();
        expect(row.querySelector('.skeleton-due')).toBeInTheDocument();
        expect(row.querySelector('.skeleton-status')).toBeInTheDocument();
    });
});
//# sourceMappingURL=AssignmentListSkeleton.test.js.map