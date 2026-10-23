import { describe, expect, it } from 'vitest';
import { evaluatePrMergeReadiness, type MergeReadinessFacts } from '../review/prMergeReadiness';
import { pullRequestNextStepOf } from './pullRequestNextStepOf';

const OPEN: MergeReadinessFacts = {
  pr: { baseBranch: 'main', mergeable: true },
  phase: 'open',
  checks: 'green',
  failingChecks: [],
  runningChecks: 0,
  review: 'review_required',
  changesRequestedBy: [],
  hasConflicts: false,
  writeInFlight: null,
  commentsNeedYou: 0,
  isFixRunLive: false,
};

type RowParams = {
  readonly state?: Parameters<typeof pullRequestNextStepOf>[0]['state'];
  readonly facts?: Partial<MergeReadinessFacts>;
  readonly hasReviewer?: boolean;
  readonly behind?: number;
  readonly isStopOpen?: boolean;
};

const stepOf = ({
  state = 'open',
  facts = {},
  hasReviewer = false,
  behind = 0,
  isStopOpen = false,
}: RowParams) => {
  const merged = { ...OPEN, ...facts };
  return pullRequestNextStepOf({
    state,
    facts: merged,
    readiness: evaluatePrMergeReadiness({ facts: merged }),
    hasReviewer,
    behind,
    isStopOpen,
  });
};

describe('pullRequestNextStepOf walks every state of the plan', () => {
  it.each([
    { name: 'no pull request', row: { state: 'none' as const }, step: null },
    { name: 'draft', row: { state: 'draft' as const }, step: 'markReady' },
    { name: 'open, nobody asked', row: {}, step: 'requestReview' },
    { name: 'waiting on a reviewer', row: { hasReviewer: true }, step: null },
    {
      name: 'changes requested',
      row: { hasReviewer: true, facts: { review: 'changes_requested' as const } },
      step: 'fixComments',
    },
    {
      name: 'checks running',
      row: { hasReviewer: true, facts: { checks: 'pending' as const, runningChecks: 1 } },
      step: null,
    },
    {
      name: 'checks failing',
      row: { hasReviewer: true, facts: { checks: 'failing' as const, failingChecks: ['e2e'] } },
      step: 'fixChecks',
    },
    {
      name: 'comments need you while the branch is behind',
      row: { hasReviewer: true, behind: 7, facts: { review: null, commentsNeedYou: 1 } },
      step: 'fixComments',
    },
    {
      name: 'conflicts in a rebase',
      row: { hasReviewer: true, behind: 7, isStopOpen: true },
      step: null,
    },
    {
      name: 'someone pushed',
      row: { hasReviewer: true, isStopOpen: true, facts: { review: 'approved' as const } },
      step: null,
    },
    {
      name: 'approved',
      row: {
        state: 'approved' as const,
        hasReviewer: true,
        facts: { review: 'approved' as const },
      },
      step: 'merge',
    },
    { name: 'in merge queue', row: { state: 'queued' as const }, step: null },
    { name: 'merged', row: { state: 'merged' as const }, step: null },
    { name: 'closed', row: { state: 'closed' as const }, step: 'reopen' },
  ])('$name', ({ row, step }) => {
    expect(stepOf(row)).toBe(step);
  });

  it('rebases a branch that is only behind', () => {
    expect(
      stepOf({
        state: 'approved',
        hasReviewer: true,
        behind: 7,
        facts: { review: 'approved', pr: { baseBranch: 'main', mergeable: null } },
      }),
    ).toBe('rebase');
  });

  it('rebases a pull request the host says conflicts, when the base moved', () => {
    expect(stepOf({ hasReviewer: true, behind: 3, facts: { hasConflicts: true } })).toBe('rebase');
    expect(stepOf({ hasReviewer: true, behind: 0, facts: { hasConflicts: true } })).toBeNull();
  });

  it('waits while a fix run is live on the comments', () => {
    expect(
      stepOf({
        hasReviewer: true,
        facts: { review: 'changes_requested', isFixRunLive: true },
      }),
    ).toBeNull();
  });
});
