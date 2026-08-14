// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmPill } from '../components/ConfirmPill';

afterEach(cleanup);

describe('ConfirmPill', () => {
  it('fires onConfirm and onCancel from their respective buttons', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmPill
        label="Delete?"
        confirmAria="delete session"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'delete session' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('disables both buttons while busy', () => {
    render(
      <ConfirmPill
        label="Delete?"
        confirmAria="delete session"
        busy
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'delete session' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
  });
});
