import { describe, expect, it } from 'vitest';
import { taskPlacementLabel } from './taskPlacementLabel';

describe('taskPlacementLabel', () => {
  it('says a task with no branch is not on one yet', () => {
    expect(taskPlacementLabel({ branches: [] })).toBe('Not on a branch yet');
  });

  it('names the branch when there is one', () => {
    expect(taskPlacementLabel({ branches: ['hl/ledger-export'] })).toBe('On hl/ledger-export');
  });

  it('counts the branches when there are several', () => {
    expect(taskPlacementLabel({ branches: ['hl/ledger-export', 'hl/notify-retry'] })).toBe(
      'On 2 branches',
    );
  });
});
