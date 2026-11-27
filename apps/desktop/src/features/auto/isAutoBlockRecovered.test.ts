import { describe, expect, it } from 'vitest';
import type { AutoDelegation } from '@goodboy/db';
import { aDelegation } from './testing/autoViewFixtures';
import { isAutoBlockRecovered } from './isAutoBlockRecovered';

type Row = Partial<AutoDelegation> & { readonly key: string };

const delegationOf = ({ key, ...rest }: Row): AutoDelegation => ({
  ...aDelegation({
    key,
    role: 'builder',
    state: 'settled',
    outcome: 'completed',
    settledAt: 20,
  }),
  target: { mountId: 'mount-ledger-core' },
  createdAt: 10,
  ...rest,
});

const BLOCKED = delegationOf({ key: 'd1', outcome: 'blocked' });

describe('isAutoBlockRecovered', () => {
  it('stays blocked with no later delegation', () => {
    expect(isAutoBlockRecovered({ delegations: [BLOCKED] })).toBe(false);
  });

  it('rests when a later delegation for the same role and step completed', () => {
    const later = delegationOf({ key: 'd2', createdAt: 30, settledAt: 40 });
    expect(isAutoBlockRecovered({ delegations: [BLOCKED, later] })).toBe(true);
  });

  it('stays blocked when the later delegation has not completed', () => {
    const later = delegationOf({ key: 'd2', createdAt: 30, state: 'running', outcome: null });
    expect(isAutoBlockRecovered({ delegations: [BLOCKED, later] })).toBe(false);
  });

  it('stays blocked when the later delegation failed', () => {
    const later = delegationOf({ key: 'd2', createdAt: 30, outcome: 'failed' });
    expect(isAutoBlockRecovered({ delegations: [BLOCKED, later] })).toBe(false);
  });

  it('stays blocked when another role completed', () => {
    const later = delegationOf({ key: 'd2', createdAt: 30, role: 'reviewer' });
    expect(isAutoBlockRecovered({ delegations: [BLOCKED, later] })).toBe(false);
  });

  it('stays blocked when another step (mount) completed', () => {
    const later = delegationOf({
      key: 'd2',
      createdAt: 30,
      target: { mountId: 'mount-notify-relay' },
    });
    expect(isAutoBlockRecovered({ delegations: [BLOCKED, later] })).toBe(false);
  });

  it('stays blocked when the completed delegation predates the block', () => {
    const earlier = delegationOf({ key: 'd0', createdAt: 1 });
    expect(isAutoBlockRecovered({ delegations: [earlier, BLOCKED] })).toBe(false);
  });

  it('stays blocked while a second blocked delegation has no recovery', () => {
    const other = delegationOf({
      key: 'd3',
      outcome: 'blocked',
      target: { mountId: 'mount-notify-relay' },
    });
    const later = delegationOf({ key: 'd2', createdAt: 30 });
    expect(isAutoBlockRecovered({ delegations: [BLOCKED, other, later] })).toBe(false);
  });

  it('has nothing to recover without a blocked delegation', () => {
    expect(isAutoBlockRecovered({ delegations: [delegationOf({ key: 'd2' })] })).toBe(false);
  });
});
