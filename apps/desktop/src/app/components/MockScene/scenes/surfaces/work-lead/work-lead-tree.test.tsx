import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WORK_LEAD_TREE_SCENES } from './work-lead-tree';

describe('work-lead-tree scene', () => {
  it('shows only the words of the user as notes', () => {
    const Scene = WORK_LEAD_TREE_SCENES['work-lead-tree'];
    const { container } = render(<Scene />);

    screen.getByText('Also cover the batch endpoint');
    screen.getByText('Keep the ledger export as it is');
    expect(container.textContent).not.toMatch(/Denied|Permission for|Continue the|oq-answers/);
  });
});
