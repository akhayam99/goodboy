import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkflowKillButton } from './WorkflowKillButton';

describe('WorkflowKillButton', () => {
  afterEach(cleanup);

  it('confirms before discarding the workflow', () => {
    const onConfirm = vi.fn();
    render(<WorkflowKillButton onConfirm={onConfirm} />);

    const button = screen.getByRole('button', { name: 'discard workflow' });
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(button.textContent).toContain('Confirm discard');

    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
