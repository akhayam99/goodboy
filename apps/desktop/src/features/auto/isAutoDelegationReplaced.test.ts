import { describe, expect, it } from 'vitest';
import type { AutoDelegation } from '@goodboy/db';
import { aDelegation, FIXTURE_NOW } from './testing/autoViewFixtures';
import { isAutoDelegationReplaced } from './isAutoDelegationReplaced';

type StartedParams = {
  readonly key: string;
  readonly role: string;
  readonly createdAt: number;
  readonly state?: AutoDelegation['state'];
  readonly outcome?: AutoDelegation['outcome'];
  readonly settledAt?: number | null;
};

const startedOnBranch = ({
  key,
  role,
  createdAt,
  state = 'running',
  outcome = null,
  settledAt = null,
}: StartedParams): AutoDelegation => ({
  ...aDelegation({ key, role, state, outcome, settledAt }),
  target: { mountId: 'mount-ledger-drawers' },
  createdAt,
});

describe('isAutoDelegationReplaced', () => {
  it('does not count parallel work that started before the child returned', () => {
    const scout = startedOnBranch({
      key: 'scout',
      role: 'scout',
      createdAt: FIXTURE_NOW,
      state: 'settled',
      outcome: 'blocked',
      settledAt: FIXTURE_NOW + 3_000,
    });
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 1_000,
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      false,
    );
  });

  it('counts a role Auto started on the same branch after the child returned', () => {
    const scout = startedOnBranch({
      key: 'scout',
      role: 'scout',
      createdAt: FIXTURE_NOW,
      state: 'settled',
      outcome: 'blocked',
      settledAt: FIXTURE_NOW + 3_000,
    });
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      true,
    );
  });
});
