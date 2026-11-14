import { describe, expect, it } from 'vitest';
import { leadTreeOf, type LeadTreeDelegation } from './leadTreeOf';

const LEAD = 'lead';

const delegation = ({
  id,
  ...rest
}: Partial<LeadTreeDelegation> & { readonly id: string }): LeadTreeDelegation => ({
  id,
  agentId: `agent-${id}`,
  parentAgentId: LEAD,
  retryOfId: null,
  role: 'implementer',
  createdAt: 0,
  isSettled: false,
  mountId: 'm1',
  spendUsd: 1,
  ...rest,
});

const treeOf = ({
  delegations,
  notes = [],
  plans = [],
  openFoldIds = new Set<string>(),
  leadSpendUsd = 0,
  primaryMountId = 'm1',
}: {
  readonly delegations: ReadonlyArray<LeadTreeDelegation>;
  readonly notes?: ReadonlyArray<{ readonly id: string; readonly createdAt: number }>;
  readonly plans?: ReadonlyArray<{ readonly id: string; readonly createdAt: number }>;
  readonly openFoldIds?: ReadonlySet<string>;
  readonly leadSpendUsd?: number;
  readonly primaryMountId?: string | null;
}) =>
  leadTreeOf({
    delegations,
    notes,
    plans,
    leadAgentId: LEAD,
    leadSpendUsd,
    primaryMountId,
    openFoldIds,
  });

const numbersOf = (rows: ReturnType<typeof treeOf>['rows']) =>
  rows.flatMap((row) => (row.kind === 'agent' ? [row.number] : []));

describe('leadTreeOf', () => {
  it('numbers agents by launch and children under their parent', () => {
    const tree = treeOf({
      delegations: [
        delegation({ id: 'b', createdAt: 20 }),
        delegation({ id: 'a', createdAt: 10 }),
        delegation({ id: 'c', createdAt: 30, parentAgentId: 'agent-b' }),
      ],
    });
    expect(numbersOf(tree.rows)).toEqual(['1', '2', '2.1']);
    expect(tree.rows.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(tree.rows.map((row) => row.depth)).toEqual([0, 0, 1]);
  });

  it('folds a settled set to one line and opens it on demand', () => {
    const delegations = [1, 2, 3].map((n) =>
      delegation({ id: `s${n}`, createdAt: n, role: 'scout', isSettled: true }),
    );
    const folded = treeOf({ delegations });
    expect(folded.rows).toHaveLength(1);
    expect(folded.rows[0]).toMatchObject({ kind: 'fold', count: 3, role: 'scout', isOpen: false });
    const open = treeOf({ delegations, openFoldIds: new Set([`fold:${LEAD}`]) });
    expect(open.rows.map((row) => row.kind)).toEqual(['fold', 'agent', 'agent', 'agent']);
    expect(numbersOf(open.rows)).toEqual(['1', '2', '3']);
  });

  it('does not fold while one member is live or a descendant is live', () => {
    const live = treeOf({
      delegations: [
        delegation({ id: 'a', createdAt: 1, isSettled: true }),
        delegation({ id: 'b', createdAt: 2, isSettled: true }),
        delegation({ id: 'c', createdAt: 3, parentAgentId: 'agent-b' }),
      ],
    });
    expect(live.rows.some((row) => row.kind === 'fold')).toBe(false);
  });

  it('folds a retry into the agent it retries', () => {
    const tree = treeOf({
      delegations: [
        delegation({ id: 'a', createdAt: 1, isSettled: true, spendUsd: 2 }),
        delegation({ id: 'a2', createdAt: 5, retryOfId: 'a', spendUsd: 3 }),
        delegation({ id: 'b', createdAt: 3 }),
      ],
    });
    expect(numbersOf(tree.rows)).toEqual(['1', '2']);
    const first = tree.rows[0];
    expect(first).toMatchObject({
      kind: 'agent',
      id: 'a2',
      agentId: 'agent-a2',
      ownSpendUsd: 5,
      isSettled: false,
    });
    expect(first?.kind === 'agent' ? first.attempts.map((a) => a.delegationId) : []).toEqual([
      'a',
      'a2',
    ]);
  });

  it('keeps children of a retried agent under the same number', () => {
    const tree = treeOf({
      delegations: [
        delegation({ id: 'a', createdAt: 1, isSettled: true }),
        delegation({ id: 'a2', createdAt: 5, retryOfId: 'a' }),
        delegation({ id: 'k', createdAt: 6, parentAgentId: 'agent-a2' }),
      ],
    });
    expect(numbersOf(tree.rows)).toEqual(['1', '1.1']);
  });

  it('places notes and plans by time between agents', () => {
    const tree = treeOf({
      delegations: [
        delegation({ id: 'a', createdAt: 10 }),
        delegation({ id: 'b', createdAt: 40 }),
        delegation({ id: 'c', createdAt: 25, parentAgentId: 'agent-a' }),
      ],
      notes: [{ id: 'n', createdAt: 30 }],
      plans: [{ id: 'p', createdAt: 5 }],
    });
    expect(tree.rows.map((row) => `${row.kind}:${row.id}`)).toEqual([
      'plan:p',
      'agent:a',
      'agent:c',
      'note:n',
      'agent:b',
    ]);
    expect(numbersOf(tree.rows)).toEqual(['1', '1.1', '2']);
  });

  it('sums spend once per agent, per branch and in total', () => {
    const tree = treeOf({
      delegations: [
        delegation({ id: 'a', createdAt: 1, spendUsd: 2 }),
        delegation({ id: 'c', createdAt: 2, parentAgentId: 'agent-a', spendUsd: 4 }),
        delegation({ id: 'dup', createdAt: 3, agentId: 'agent-a', spendUsd: 9 }),
      ],
      leadSpendUsd: 10,
    });
    expect(tree.totalSpendUsd).toBe(16);
    const first = tree.rows[0];
    expect(first?.kind === 'agent' ? first.branchSpendUsd : 0).toBe(6);
  });

  it('splits spend per branch and sums to the total, counting a two branch Lead once', () => {
    const tree = treeOf({
      delegations: [
        delegation({ id: 'a', createdAt: 1, mountId: 'm1', spendUsd: 2 }),
        delegation({ id: 'b', createdAt: 2, mountId: 'm2', spendUsd: 3 }),
        delegation({ id: 'c', createdAt: 3, mountId: null, spendUsd: 5 }),
      ],
      leadSpendUsd: 7,
      primaryMountId: 'm2',
    });
    const byMount = Object.fromEntries(
      tree.spendByBranch.map((entry) => [entry.mountId, entry.spendUsd]),
    );
    expect(byMount).toEqual({ m1: 2, m2: 10, null: 5 });
    expect(tree.spendByBranch.reduce((sum, entry) => sum + entry.spendUsd, 0)).toBe(
      tree.totalSpendUsd,
    );
  });

  it('sends the Lead own turns to Not on a branch when it has no primary branch', () => {
    const tree = treeOf({
      delegations: [delegation({ id: 'a', mountId: 'm1', spendUsd: 2 })],
      leadSpendUsd: 4,
      primaryMountId: null,
    });
    expect(tree.spendByBranch).toEqual([
      { mountId: 'm1', spendUsd: 2 },
      { mountId: null, spendUsd: 4 },
    ]);
  });
});
