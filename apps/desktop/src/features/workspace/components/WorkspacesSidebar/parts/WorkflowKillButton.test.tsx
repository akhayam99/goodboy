import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkflowKillButton } from './WorkflowKillButton';

describe('WorkflowKillButton', () => {
  afterEach(cleanup);

  it('confirms before discarding the workflow', () => {
    const onConfirm = vi.fn();
    render(<WorkflowKillButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'discard workflow' }));
    expect(onConfirm).not.toHaveBeenCalled();

    const panel = screen.getByRole('group', { name: 'Discard workflow?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Discard' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('disarms without discarding when the confirmation is cancelled', () => {
    const onConfirm = vi.fn();
    render(<WorkflowKillButton onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'discard workflow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Discard workflow?' })).toBeNull();
    expect(screen.getByRole('button', { name: 'discard workflow' })).toBeDefined();
  });

  it('keeps the trigger mounted and marked as expanded while armed', () => {
    render(<WorkflowKillButton onConfirm={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: 'discard workflow' });
    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('group', { name: 'Discard workflow?' })).toBeDefined();
  });
});
