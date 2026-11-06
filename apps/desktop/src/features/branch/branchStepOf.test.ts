// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  branchStepOf,
  NO_COMMENT_FACTS,
  type BranchCheckFacts,
  type BranchCommentFacts,
  type BranchLifecycleStep,
  type BranchPushFacts,
} from './branchStepOf';

const NO_PUSH: BranchPushFacts = { isInFlight: false, failed: 0, canPush: false, replies: 0 };

const NO_CHECK_FACTS: BranchCheckFacts = { isFailing: false, isAwaitingRun: false, chain: 'none' };

type RowParams = {
  readonly state?: Parameters<typeof branchStepOf>[0]['state'];
  readonly lifecycle?: BranchLifecycleStep;
  readonly hasConflicts?: boolean;
  readonly comments?: Partial<BranchCommentFacts>;
  readonly checks?: Partial<BranchCheckFacts>;
  readonly push?: Partial<BranchPushFacts>;
};

const stepOf = ({
  state = 'open',
  lifecycle = null,
  hasConflicts = false,
  comments = {},
  checks = {},
  push = {},
}: RowParams) =>
  branchStepOf({
    state,
    lifecycle,
    hasConflicts,
    comments: { ...NO_COMMENT_FACTS, ...comments },
    checks: { ...NO_CHECK_FACTS, ...checks },
    push: { ...NO_PUSH, ...push },
  });

const EVERYTHING: RowParams = {
  lifecycle: 'merge',
  comments: { questionThreadId: 'thread-ledger', waitingFixes: 7, fixable: 4 },
  checks: { isFailing: true, chain: 'proposal' },
  push: { failed: 1, canPush: true, replies: 2 },
};

describe('branchStepOf walks the order table, one row per step', () => {
  it.each([
    { order: 1, name: 'a fix asks you something', row: EVERYTHING, step: 'answer' },
    {
      order: 2,
      name: 'fixes ready',
      row: { ...EVERYTHING, comments: { ...EVERYTHING.comments, questionThreadId: null } },
      step: 'apply',
    },
    {
      order: 2,
      name: 'a push failed',
      row: {
        ...EVERYTHING,
        comments: { fixable: 4 },
      },
      step: 'retryPush',
    },
    {
      order: 3,
      name: 'comments to fix',
      row: { ...EVERYTHING, comments: { fixable: 4 }, push: { canPush: true, replies: 2 } },
      step: 'fixComments',
    },
    {
      order: 4,
      name: 'work not pushed',
      row: { ...EVERYTHING, comments: {}, push: { canPush: true, replies: 2 } },
      step: 'push',
    },
    {
      order: 4,
      name: 'replies not published',
      row: { ...EVERYTHING, comments: {}, push: { replies: 2 } },
      step: 'publish',
    },
    {
      order: 5,
      name: 'a check fix waits to be pushed',
      row: {
        ...EVERYTHING,
        comments: {},
        checks: { isFailing: true, chain: 'fixed-local' },
        push: { canPush: true },
      },
      step: 'pushCheckFix',
    },
    {
      order: 5,
      name: 'a check fix is proposed',
      row: { ...EVERYTHING, comments: {}, push: {} },
      step: 'startCheckFix',
    },
    {
      order: 5,
      name: 'checks still red',
      row: { lifecycle: 'merge', checks: { isFailing: true } },
      step: 'fixChecks',
    },
    {
      order: 5,
      name: 'checks still red after an empty analysis',
      row: { lifecycle: 'merge', checks: { isFailing: true, chain: 'no-fix' } },
      step: 'fixChecks',
    },
    {
      order: 5,
      name: 'checks still red after a stopped fix',
      row: { checks: { isFailing: true, chain: 'fix-failed' } },
      step: 'fixChecks',
    },
    { order: 6, name: 'draft', row: { state: 'draft', lifecycle: 'markReady' }, step: 'markReady' },
    { order: 6, name: 'nobody asked', row: { lifecycle: 'requestReview' }, step: 'requestReview' },
    {
      order: 7,
      name: 'ready',
      row: { state: 'approved', lifecycle: 'merge' },
      step: 'merge',
    },
    { order: 8, name: 'merged', row: { ...EVERYTHING, state: 'merged' }, step: null },
  ] satisfies ReadonlyArray<{
    readonly order: number;
    readonly name: string;
    readonly row: RowParams;
    readonly step: ReturnType<typeof branchStepOf>;
  }>)('$order $name', ({ row, step }) => {
    expect(stepOf(row)).toBe(step);
  });
});

describe('branchStepOf keeps the order that cannot stick', () => {
  const redChecks: Partial<BranchCheckFacts> = { isFailing: true, chain: 'none' };

  it('rebases a conflict before it fixes red checks', () => {
    expect(stepOf({ lifecycle: 'rebase', hasConflicts: true, checks: redChecks })).toBe('rebase');
  });

  it('still pushes and publishes before it rebases a conflict', () => {
    expect(
      stepOf({
        lifecycle: 'rebase',
        hasConflicts: true,
        checks: redChecks,
        push: { canPush: true },
      }),
    ).toBe('push');
    expect(
      stepOf({ lifecycle: 'rebase', hasConflicts: true, checks: redChecks, push: { replies: 1 } }),
    ).toBe('publish');
  });

  it('fixes red checks when there is no conflict to rebase', () => {
    expect(stepOf({ lifecycle: 'rebase', checks: redChecks })).toBe('fixChecks');
    expect(stepOf({ lifecycle: null, hasConflicts: true, checks: redChecks })).toBe('fixChecks');
  });

  it('draws no check step while the pushed fix waits for a new run, then reads the run', () => {
    const waiting = { isFailing: true, isAwaitingRun: true, chain: 'fixed-pushed' } as const;
    expect(stepOf({ lifecycle: null, checks: waiting })).toBeNull();
    expect(stepOf({ lifecycle: 'requestReview', checks: waiting })).toBe('requestReview');
    expect(stepOf({ lifecycle: null, checks: { ...waiting, isAwaitingRun: false } })).toBe(
      'fixChecks',
    );
  });
});

describe('branchStepOf while an agent works', () => {
  it('draws no step while a fix run works on the comments', () => {
    expect(stepOf({ ...EVERYTHING, comments: { isFixRunLive: true, fixable: 4 } })).toBe('working');
  });

  it.each(['analyzing', 'fixing'] as const)('draws no step while a check agent is %s', (chain) => {
    expect(stepOf({ lifecycle: 'merge', checks: { isFailing: true, chain } })).toBe('working');
  });

  it('still asks the question a working run waits on', () => {
    expect(stepOf({ comments: { isFixRunLive: true, questionThreadId: 'thread-ledger' } })).toBe(
      'answer',
    );
  });

  it('keeps a push that is already going up', () => {
    expect(
      stepOf({ ...EVERYTHING, comments: { isFixRunLive: true }, push: { isInFlight: true } }),
    ).toBe('push');
  });
});

describe('branchStepOf at both ends of a branch', () => {
  it('fixes the notes before a pull request, then follows the start step', () => {
    expect(stepOf({ state: 'none', lifecycle: 'push', comments: { fixable: 4 } })).toBe(
      'fixComments',
    );
    expect(stepOf({ state: 'none', lifecycle: 'push' })).toBe('push');
    expect(stepOf({ state: 'none', lifecycle: 'rebase', comments: { fixable: 2 } })).toBe(
      'fixComments',
    );
    expect(stepOf({ state: 'none', lifecycle: null })).toBeNull();
  });

  it('answers, waits and applies before a pull request too', () => {
    const notes = { state: 'none' as const, lifecycle: 'push' as const };
    expect(stepOf({ ...notes, comments: { questionThreadId: 'note-ledger' } })).toBe('answer');
    expect(stepOf({ ...notes, comments: { isFixRunLive: true, fixable: 1 } })).toBe('working');
    expect(stepOf({ ...notes, comments: { waitingFixes: 2 } })).toBe('apply');
  });

  it('reopens a closed pull request and nothing else', () => {
    expect(stepOf({ ...EVERYTHING, state: 'closed', lifecycle: 'reopen' })).toBe('reopen');
  });

  it('only moves commits and replies in the merge queue', () => {
    expect(stepOf({ ...EVERYTHING, state: 'queued', push: { canPush: true } })).toBe('push');
    expect(stepOf({ state: 'queued', lifecycle: 'merge' })).toBeNull();
  });

  it('keeps Retry push and Publish reachable as steps in the merge queue', () => {
    expect(stepOf({ ...EVERYTHING, state: 'queued' })).toBe('retryPush');
    expect(stepOf({ state: 'queued', lifecycle: 'merge', push: { replies: 2 } })).toBe('publish');
    expect(stepOf({ state: 'queued', push: { isInFlight: true, failed: 1 } })).toBe('push');
  });

  it('leaves a green, pushed branch to the pull request lifecycle', () => {
    expect(stepOf({ lifecycle: 'rebase', checks: { chain: 'no-fix' } })).toBe('rebase');
    expect(stepOf({ lifecycle: null })).toBeNull();
  });
});
