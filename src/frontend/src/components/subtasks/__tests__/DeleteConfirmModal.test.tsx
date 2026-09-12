/**
 * DeleteConfirmModal Component Tests
 *
 * Covers open/closed rendering, accessible dialog semantics, default
 * focus on Cancel, confirm/cancel actions, overlay click, and Escape.
 */

// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeleteConfirmModal } from '../DeleteConfirmModal';

describe('DeleteConfirmModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when closed', () => {
    render(
      <DeleteConfirmModal
        open={false}
        subTaskTitle="Chapter 1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders an accessible dialog naming the sub-task', () => {
    render(
      <DeleteConfirmModal open subTaskTitle="Chapter 1" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/Chapter 1/)).toBeInTheDocument();
  });

  it('focuses the Cancel button by default', async () => {
    render(
      <DeleteConfirmModal open subTaskTitle="Chapter 1" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
  });

  it('calls onConfirm when Delete is clicked', async () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmModal open subTaskTitle="Chapter 1" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = vi.fn();
    render(
      <DeleteConfirmModal open subTaskTitle="Chapter 1" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the overlay is clicked', async () => {
    const onCancel = vi.fn();
    render(
      <DeleteConfirmModal open subTaskTitle="Chapter 1" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    await userEvent.click(overlay);

    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed', async () => {
    const onCancel = vi.fn();
    render(
      <DeleteConfirmModal open subTaskTitle="Chapter 1" onConfirm={vi.fn()} onCancel={onCancel} />,
    );

    await userEvent.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
