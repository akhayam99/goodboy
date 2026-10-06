import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkflowCloseButton } from './index';

describe('WorkflowCloseButton', () => {
  afterEach(cleanup);

  it('confirms before closing the workflow', () => {
    const onConfirm = vi.fn();
    render(<WorkflowCloseButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    expect(onConfirm).not.toHaveBeenCalled();

    const panel = screen.getByRole('group', { name: 'Stop this run?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Stop run' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('keeps the run open when the confirmation is cancelled', () => {
    const onConfirm = vi.fn();
    render(<WorkflowCloseButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Stop this run?' })).toBeNull();
  });
});
