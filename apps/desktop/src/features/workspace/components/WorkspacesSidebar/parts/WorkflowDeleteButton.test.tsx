import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkflowDeleteButton } from './WorkflowDeleteButton';

describe('WorkflowDeleteButton', () => {
  afterEach(cleanup);

  it('confirms before deleting the workflow run', () => {
    const onConfirm = vi.fn();
    render(<WorkflowDeleteButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).not.toHaveBeenCalled();

    const panel = screen.getByRole('group', { name: 'Delete workflow run?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('disarms without deleting when the confirmation is cancelled', () => {
    const onConfirm = vi.fn();
    render(<WorkflowDeleteButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Delete workflow run?' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});
