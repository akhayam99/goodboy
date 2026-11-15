import { describe, expect, it } from 'vitest';
import { leadSpendByBranchOf } from './leadSpendByBranchOf';

describe('leadSpendByBranchOf', () => {
  it('counts an agent listed twice once', () => {
    const rows = leadSpendByBranchOf({
      agents: [
        { agentId: 'a', mountId: 'm1', spendUsd: 2 },
        { agentId: 'a', mountId: 'm1', spendUsd: 2 },
      ],
      leadSpendUsd: 0,
      primaryMountId: 'm1',
    });
    expect(rows).toEqual([{ mountId: 'm1', spendUsd: 2 }]);
  });

  it('puts the Lead turns on the primary branch', () => {
    const rows = leadSpendByBranchOf({
      agents: [{ agentId: 'a', mountId: 'm2', spendUsd: 1 }],
      leadSpendUsd: 3,
      primaryMountId: 'm1',
    });
    expect(rows).toEqual([
      { mountId: 'm2', spendUsd: 1 },
      { mountId: 'm1', spendUsd: 3 },
    ]);
  });
});
