// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkflowRunMenu } from './index';

describe('WorkflowRunMenu', () => {
  afterEach(cleanup);

  it('swaps the menu for a confirm before deleting the workflow run', () => {
    const onDelete = vi.fn();
    render(<WorkflowRunMenu workflowName="Refactor" onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Refactor workflow actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete workflow run' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('menuitem', { name: 'Delete workflow run' })).toBeNull();

    const panel = screen.getByRole('group', { name: 'Delete workflow run?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('returns to the menu without deleting when the confirmation is cancelled', () => {
    const onDelete = vi.fn();
    render(<WorkflowRunMenu workflowName="Refactor" onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Refactor workflow actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete workflow run' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'Delete workflow run' })).toBeDefined();
  });

  it('lists close, discard and delete in that order, each only when offered', () => {
    render(
      <WorkflowRunMenu
        workflowName="Refactor"
        onClose={vi.fn()}
        onDiscard={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refactor workflow actions' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Close workflow',
      'Discard workflow',
      'Delete workflow run',
    ]);
  });

  it('confirms before closing the workflow run', () => {
    const onClose = vi.fn();
    render(<WorkflowRunMenu workflowName="Refactor" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Refactor workflow actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Close workflow' }));
    expect(onClose).not.toHaveBeenCalled();

    const panel = screen.getByRole('group', { name: 'Close this workflow?' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close workflow' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing when no action is offered', () => {
    const { container } = render(<WorkflowRunMenu workflowName="Refactor" />);

    expect(container.childElementCount).toBe(0);
  });
});
