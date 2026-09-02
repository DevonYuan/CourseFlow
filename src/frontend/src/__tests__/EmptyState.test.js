import { jsx as _jsx } from "react/jsx-runtime";
/**
 * EmptyState Tests
 *
 * Tests for the empty state component.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../components/EmptyState';
describe('EmptyState', () => {
    const mockOnOpenSettings = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it('renders default message and subtext', () => {
        render(_jsx(EmptyState, { onOpenSettings: mockOnOpenSettings }));
        expect(screen.getByText('No assignments yet')).toBeInTheDocument();
        expect(screen.getByText('Add your Canvas iCal URL in Settings to get started')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
    });
    it('renders custom message, subtext, and CTA text', () => {
        render(_jsx(EmptyState, { onOpenSettings: mockOnOpenSettings, message: "Custom message", subtext: "Custom subtext", ctaText: "Custom CTA" }));
        expect(screen.getByText('Custom message')).toBeInTheDocument();
        expect(screen.getByText('Custom subtext')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Custom CTA' })).toBeInTheDocument();
    });
    it('calls onOpenSettings when CTA button is clicked', () => {
        render(_jsx(EmptyState, { onOpenSettings: mockOnOpenSettings }));
        fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
        expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
    });
    it('has proper ARIA attributes', () => {
        render(_jsx(EmptyState, { onOpenSettings: mockOnOpenSettings }));
        const container = screen.getByRole('status');
        expect(container).toHaveAttribute('aria-live', 'polite');
    });
    it('renders illustration SVG', () => {
        render(_jsx(EmptyState, { onOpenSettings: mockOnOpenSettings }));
        // SVG is inside aria-hidden div, so not accessible by role
        // Check for the illustration container instead
        const illustration = screen.getByTestId('empty-state-illustration');
        expect(illustration).toBeInTheDocument();
    });
    it('heading has proper structure', () => {
        render(_jsx(EmptyState, { onOpenSettings: mockOnOpenSettings }));
        const heading = screen.getByRole('heading', { level: 2 });
        expect(heading).toHaveTextContent('No assignments yet');
    });
});
//# sourceMappingURL=EmptyState.test.js.map