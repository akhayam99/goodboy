import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { WORK_LEAD_TREE_SCENES } from './work-lead-tree';

afterEach(cleanup);

describe('work-lead-tree scene', () => {
  it('shows only the words of the user as notes, under the agent they steered', () => {
    const Scene = WORK_LEAD_TREE_SCENES['work-lead-tree'];
    const { container } = render(<Scene />);

    screen.getByText('Also cover the batch endpoint');
    screen.getByText('Keep the ledger export as it is');
    expect(container.textContent).not.toMatch(/Denied|Permission for|Continue the|oq-answers/);
    expect(container.querySelectorAll('[data-lead-tree-agent]')).toHaveLength(9);
    expect(container.querySelectorAll('[data-lead-tree-note]').length).toBeGreaterThanOrEqual(8);
  });

  it('folds a turn with many messages into one row', () => {
    const Scene = WORK_LEAD_TREE_SCENES['work-lead-tree'];
    render(<Scene />);
    screen.getByRole('treeitem', { name: /more messages? from you/ });
  });
});
