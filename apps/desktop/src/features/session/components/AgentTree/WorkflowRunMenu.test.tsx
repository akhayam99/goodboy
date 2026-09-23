// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WorkflowRunMenu } from './WorkflowRunMenu';

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
});
