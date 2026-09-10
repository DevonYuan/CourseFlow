/**
 * ConfirmModal Component Tests
 *
 * Covers open/close rendering, confirm/cancel callbacks, Escape handling,
 * initial focus, focus trap, focus restoration, and loading state.
 */

// @vitest-environment jsdom

import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmModal } from '../components/ui/ConfirmModal';

describe('ConfirmModal', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders nothing when closed', () => {
    render(
      <ConfirmModal open={false} title="Delete?" message="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, message and actions when open', () => {
    render(
      <ConfirmModal
        open
        title="Delete note?"
        message="This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Delete note?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        open
        title="Delete?"
        message="Sure?"
        confirmText="Delete"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        open
        title="Delete?"
        message="Sure?"
        confirmText="Delete"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal open title="Delete?" message="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the overlay is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmModal open title="Delete?" message="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('focuses the Cancel button by default', async () => {
    render(
      <ConfirmModal open title="Delete?" message="Sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
  });

  it('shows a loading state and disables buttons', () => {
    render(
      <ConfirmModal open title="Delete?" message="Sure?" isLoading onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Please wait...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('restores focus to the trigger when closed', async () => {
    function Harness(): JSX.Element {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open modal
          </button>
          <ConfirmModal
            open={open}
            title="Delete?"
            message="Sure?"
            onConfirm={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open modal' });
    await user.click(trigger);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps focus within the modal', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmModal
        open
        title="Delete?"
        message="Sure?"
        confirmText="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());

    // Tab moves from Cancel to Delete
    await user.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();

    // Tab from the last element wraps back to the first
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });
});
