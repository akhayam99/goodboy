import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkflowCloseButton } from './index';

describe('WorkflowCloseButton', () => {
  afterEach(cleanup);

  it('confirms before closing the workflow', () => {
    const onConfirm = vi.fn();
    render(<WorkflowCloseButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop workflow' }));
    expect(onConfirm).not.toHaveBeenCalled();

    const panel = screen.getByRole('group', { name: 'Stop this workflow?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Stop workflow' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('keeps the run open when the confirmation is cancelled', () => {
    const onConfirm = vi.fn();
    render(<WorkflowCloseButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop workflow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Stop this workflow?' })).toBeNull();
  });
});
