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
  readonly endReason?: string | null;
  readonly result?: unknown;
};

const startedOnBranch = ({
  key,
  role,
  createdAt,
  state = 'running',
  outcome = null,
  settledAt = null,
  endReason = null,
  result = null,
}: StartedParams): AutoDelegation => ({
  ...aDelegation({ key, role, state, outcome, settledAt, result }),
  target: { mountId: 'mount-ledger-drawers' },
  reason: endReason,
  createdAt,
});

const returnedScout = (): AutoDelegation =>
  startedOnBranch({
    key: 'scout',
    role: 'scout',
    createdAt: FIXTURE_NOW,
    state: 'settled',
    outcome: 'blocked',
    settledAt: FIXTURE_NOW + 3_000,
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

  it('does not count a successor still waiting for confirmation', () => {
    const scout = returnedScout();
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'awaiting_confirm',
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      false,
    );
  });

  it('does not count a successor the user declined', () => {
    const scout = returnedScout();
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'declined',
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      false,
    );
  });

  it('counts a successor that started and was stopped afterwards', () => {
    const scout = returnedScout();
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'user_stop',
      result: { attemptId: 'attempt-reviewer', outcome: 'stopped', reason: 'user_stop' },
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      true,
    );
  });

  it('does not count a successor tree-stopped while accepted, before any attempt', () => {
    const scout = returnedScout();
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'stopped',
      result: { schemaVersion: 1, attemptId: null, outcome: 'stopped', reason: 'stopped' },
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      false,
    );
  });

  it('does not count a successor stopped by a revise before it started', () => {
    const scout = returnedScout();
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'revise_started',
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      false,
    );
  });

  it('counts a successor tree-stopped after its attempt began', () => {
    const scout = returnedScout();
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'stopped',
      result: {
        schemaVersion: 1,
        attemptId: 'attempt-reviewer',
        outcome: 'stopped',
        reason: 'stopped',
      },
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      true,
    );
  });
});
