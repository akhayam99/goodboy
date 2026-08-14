import { describe, expect, it } from 'vitest';
import { resolverThreadDecisions } from './resolverThreadDecisions';
import type {
  ResolverThreadSettlement,
  ResolverThreadSettlementKind,
} from './resolverThreadSettlements';

const settlement = ({
  kind,
  isClosed = false,
  isQueued = false,
}: {
  readonly kind: ResolverThreadSettlementKind;
  readonly isClosed?: boolean;
  readonly isQueued?: boolean;
}): ResolverThreadSettlement => ({
  threadId: 'PRRT_1',
  kind,
  commitSha: kind === 'resolved' ? 'abc1234' : null,
  reason: kind === 'wontfix' ? 'unreachable branch' : null,
  reply: null,
  isQueued,
  isClosed,
});

const kindsOf = ({
  kind,
  isQueued = false,
  isBusy = false,
  prNumber = 7,
  actLockReason = null,
}: {
  readonly kind: ResolverThreadSettlementKind;
  readonly isQueued?: boolean;
  readonly isBusy?: boolean;
  readonly prNumber?: number | null;
  readonly actLockReason?: string | null;
}) =>
  resolverThreadDecisions({
    settlement: settlement({ kind, isQueued }),
    prNumber,
    isBusy,
    actLockReason,
  }).decisions.map(({ action }) => action.kind);

const lockedOf = ({
  kind,
  isQueued = false,
  isBusy = false,
  prNumber = 7,
  actLockReason = null,
}: {
  readonly kind: ResolverThreadSettlementKind;
  readonly isQueued?: boolean;
  readonly isBusy?: boolean;
  readonly prNumber?: number | null;
  readonly actLockReason?: string | null;
}) =>
  resolverThreadDecisions({
    settlement: settlement({ kind, isQueued }),
    prNumber,
    isBusy,
    actLockReason,
  })
    .decisions.filter(({ lockReason }) => lockReason !== null)
    .map(({ action }) => action.kind);

describe('resolverThreadDecisions', () => {
  it('leaves nothing to decide on a thread github already closed', () => {
    const plan = resolverThreadDecisions({
      settlement: settlement({ kind: 'resolved', isClosed: true }),
      prNumber: 7,
      isBusy: false,
      actLockReason: null,
    });

    expect(plan.decisions).toEqual([]);
    expect(plan.question).toContain('Closed on GitHub');
  });

  it('offers accept, refuse and write-your-own on a no-change verdict', () => {
    expect(kindsOf({ kind: 'wontfix' })).toEqual(['explain', 'fix', 'rework', 'custom']);
    expect(kindsOf({ kind: 'analyzed' })).toEqual(['explain', 'fix', 'rework', 'custom']);
  });

  it('recommends closing the thread the agent judged not worth a change', () => {
    const plan = resolverThreadDecisions({
      settlement: settlement({ kind: 'wontfix' }),
      prNumber: 7,
      isBusy: false,
      actLockReason: null,
    });
    const [first] = plan.decisions;

    expect(first?.action.kind).toBe('explain');
    expect(first?.isRecommended).toBe(true);
    expect(first?.action.confirm).not.toBeNull();
    expect(plan.question).toContain('not worth a change');
  });

  it('recommends batching a committed fix, and offers a redo with hints', () => {
    const plan = resolverThreadDecisions({
      settlement: settlement({ kind: 'resolved' }),
      prNumber: 7,
      isBusy: false,
      actLockReason: null,
    });

    expect(plan.decisions.map(({ action }) => action.kind)).toEqual(['queue', 'redo', 'custom']);
    expect(plan.decisions[0]?.isRecommended).toBe(true);
    expect(plan.decisions[1]?.notes).toBe('required');
    expect(plan.decisions[2]?.notes).toBe('required');
  });

  it('lets a refused verdict carry hints without demanding them', () => {
    const notesOf = (kind: ResolverThreadSettlementKind) =>
      Object.fromEntries(
        resolverThreadDecisions({
          settlement: settlement({ kind }),
          prNumber: 7,
          isBusy: false,
          actLockReason: null,
        }).decisions.map(({ action, notes }) => [action.kind, notes]),
      );

    expect(notesOf('wontfix')).toEqual({
      explain: 'none',
      fix: 'optional',
      rework: 'optional',
      custom: 'required',
    });
    expect(notesOf('analyzed')).toEqual({
      explain: 'none',
      fix: 'optional',
      rework: 'optional',
      custom: 'required',
    });
  });

  it('cannot batch a fix while the pull request is unknown', () => {
    const [queue] = resolverThreadDecisions({
      settlement: settlement({ kind: 'resolved' }),
      prNumber: null,
      isBusy: false,
      actLockReason: null,
    }).decisions;

    expect(queue?.action.isEnabled).toBe(false);
  });

  it('keeps the agent-bound choices visible but locked while the agent is working', () => {
    expect(kindsOf({ kind: 'wontfix', isBusy: true })).toEqual([
      'explain',
      'fix',
      'rework',
      'custom',
    ]);
    expect(lockedOf({ kind: 'wontfix', isBusy: true })).toEqual(['fix', 'rework', 'custom']);
    expect(lockedOf({ kind: 'resolved', isBusy: true })).toEqual(['redo', 'custom']);
    expect(lockedOf({ kind: 'open', isBusy: true })).toEqual(['custom']);
  });

  it('disables what it locks so no choice looks clickable', () => {
    const locked = resolverThreadDecisions({
      settlement: settlement({ kind: 'wontfix' }),
      prNumber: 7,
      isBusy: true,
      actLockReason: null,
    }).decisions.filter(({ lockReason }) => lockReason !== null);

    expect(locked.every(({ action }) => action.isEnabled)).toBe(false);
  });

  it('offers to take a batched fix back out and says why the rest is locked', () => {
    expect(kindsOf({ kind: 'resolved', isQueued: true })).toEqual(['dequeue', 'redo', 'custom']);
    expect(lockedOf({ kind: 'resolved', isQueued: true })).toEqual(['redo', 'custom']);
  });

  it('locks every choice, github ones included, when the whole resolver cannot act', () => {
    const actLockReason = 'The agent is working on this resolver right now';

    expect(lockedOf({ kind: 'resolved', actLockReason })).toEqual(['queue', 'redo', 'custom']);
    expect(lockedOf({ kind: 'wontfix', actLockReason })).toEqual([
      'explain',
      'fix',
      'rework',
      'custom',
    ]);
    expect(lockedOf({ kind: 'open', actLockReason })).toEqual(['forceResolve', 'custom']);
    expect(lockedOf({ kind: 'resolved', isQueued: true, actLockReason })).toEqual([
      'dequeue',
      'redo',
      'custom',
    ]);
  });

  it('carries the resolver-wide reason onto every locked choice, and disables it', () => {
    const actLockReason = 'Already pushed to GitHub, nothing left to steer';
    const plan = resolverThreadDecisions({
      settlement: settlement({ kind: 'wontfix' }),
      prNumber: 7,
      isBusy: false,
      actLockReason,
    });

    expect(plan.decisions.every((entry) => entry.lockReason === actLockReason)).toBe(true);
    expect(plan.decisions.some(({ action }) => action.isEnabled)).toBe(false);
  });

  it('says nothing was recorded on a thread with no outcome', () => {
    const plan = resolverThreadDecisions({
      settlement: settlement({ kind: 'open' }),
      prNumber: 7,
      isBusy: false,
      actLockReason: null,
    });

    expect(plan.question).toContain('no outcome');
    expect(plan.decisions.map(({ action }) => action.kind)).toEqual(['forceResolve', 'custom']);
  });
});
