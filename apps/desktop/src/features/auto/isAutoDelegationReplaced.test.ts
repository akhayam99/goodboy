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
  readonly request?: Readonly<Record<string, unknown>>;
  readonly retryOf?: AutoDelegation['retryOf'];
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
  request = {},
  retryOf = null,
}: StartedParams): AutoDelegation => {
  const base = aDelegation({ key, role, state, outcome, settledAt, result });
  return {
    ...base,
    request: { ...base.request, ...request },
    retryOf,
    target: { mountId: 'mount-ledger-drawers' },
    reason: endReason,
    createdAt,
  };
};

const failedScout = (): AutoDelegation =>
  startedOnBranch({
    key: 'scout',
    role: 'scout',
    createdAt: FIXTURE_NOW,
    state: 'settled',
    outcome: 'failed',
    settledAt: FIXTURE_NOW + 3_000,
  });

const returnedScout = (): AutoDelegation =>
  startedOnBranch({
    key: 'scout',
    role: 'scout',
    createdAt: FIXTURE_NOW,
    state: 'settled',
    outcome: 'blocked',
    settledAt: FIXTURE_NOW + 3_000,
    result: { outcome: 'blocked', returned: { request: 'Should archived rows be exported?' } },
  });

const legacyReturnedScout = (): AutoDelegation =>
  startedOnBranch({
    key: 'scout',
    role: 'scout',
    createdAt: FIXTURE_NOW,
    state: 'settled',
    outcome: 'blocked',
    settledAt: FIXTURE_NOW + 3_000,
    endReason: 'declared_blocked',
    result: { outcome: 'blocked', reason: 'declared_blocked' },
  });

describe('isAutoDelegationReplaced', () => {
  it('does not count parallel work that started before the child ended', () => {
    const scout = failedScout();
    const next = startedOnBranch({ key: 'scout-2', role: 'scout', createdAt: FIXTURE_NOW + 1_000 });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(false);
  });

  it('counts the same role Auto started on the same branch after the child ended', () => {
    const scout = failedScout();
    const next = startedOnBranch({ key: 'scout-2', role: 'scout', createdAt: FIXTURE_NOW + 4_000 });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(true);
  });

  it('does not count another role on the same branch after the child ended', () => {
    const scout = failedScout();
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      false,
    );
  });

  it('does not count a successor still waiting for confirmation', () => {
    const scout = failedScout();
    const next = startedOnBranch({
      key: 'scout-2',
      role: 'scout',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'awaiting_confirm',
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(false);
  });

  it('does not count a successor the user declined', () => {
    const scout = failedScout();
    const next = startedOnBranch({
      key: 'scout-2',
      role: 'scout',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'declined',
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(false);
  });

  it('counts a successor that started and was stopped afterwards', () => {
    const scout = failedScout();
    const next = startedOnBranch({
      key: 'scout-2',
      role: 'scout',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'user_stop',
      result: { attemptId: 'attempt-scout-2', outcome: 'stopped', reason: 'user_stop' },
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(true);
  });

  it('does not count a successor tree-stopped while accepted, before any attempt', () => {
    const scout = failedScout();
    const next = startedOnBranch({
      key: 'scout-2',
      role: 'scout',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'stopped',
      result: { schemaVersion: 1, attemptId: null, outcome: 'stopped', reason: 'stopped' },
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(false);
  });

  it('does not count a successor stopped by a revise before it started', () => {
    const scout = failedScout();
    const next = startedOnBranch({
      key: 'scout-2',
      role: 'scout',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'revise_started',
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(false);
  });

  it('counts a successor tree-stopped after its attempt began', () => {
    const scout = failedScout();
    const next = startedOnBranch({
      key: 'scout-2',
      role: 'scout',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'stopped',
      result: {
        schemaVersion: 1,
        attemptId: 'attempt-scout-2',
        outcome: 'stopped',
        reason: 'stopped',
      },
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(true);
  });

  it('never counts later work on the same branch as a decision about a returned child', () => {
    const scout = returnedScout();
    const same = startedOnBranch({ key: 'scout-2', role: 'scout', createdAt: FIXTURE_NOW + 4_000 });
    const other = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, same, other] })).toBe(
      false,
    );
  });

  it('counts a returned child that a later child continues with retryOf', () => {
    const scout = returnedScout();
    const next = startedOnBranch({
      key: 'scout-2',
      role: 'scout',
      createdAt: FIXTURE_NOW + 4_000,
      retryOf: scout.id,
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(true);
  });

  it('counts a returned child that a later child names in replaces', () => {
    const scout = returnedScout();
    const next = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
      request: { replaces: scout.id },
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, next] })).toBe(true);
  });

  it('does not count a proposal the user declined as a decision about a returned child', () => {
    const scout = returnedScout();
    const declined = startedOnBranch({
      key: 'scout-2',
      role: 'scout',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'settled',
      outcome: 'stopped',
      settledAt: FIXTURE_NOW + 5_000,
      endReason: 'declined',
      retryOf: scout.id,
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, declined] })).toBe(
      false,
    );
  });

  it('counts any role started later on the branch as a decision about a return from before the upgrade', () => {
    const scout = legacyReturnedScout();
    const reviewer = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 4_000,
    });

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout, reviewer] })).toBe(
      true,
    );
  });

  it('keeps a return from before the upgrade waiting while later work has not started', () => {
    const scout = legacyReturnedScout();
    const parallel = startedOnBranch({
      key: 'reviewer',
      role: 'reviewer',
      createdAt: FIXTURE_NOW + 1_000,
    });
    const proposed = startedOnBranch({
      key: 'scout-2',
      role: 'scout',
      createdAt: FIXTURE_NOW + 4_000,
      state: 'awaiting_confirm',
    });

    expect(
      isAutoDelegationReplaced({ delegation: scout, delegations: [scout, parallel, proposed] }),
    ).toBe(false);
  });

  it('counts a returned child that Auto released', () => {
    const scout = {
      ...returnedScout(),
      request: { task: 'work for scout', released: { reason: 'no longer needed', at: 1 } },
    };

    expect(isAutoDelegationReplaced({ delegation: scout, delegations: [scout] })).toBe(true);
  });
});
