import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { resolveActions } from '../resolveActions';
import { REVIEW_KIND, type ReviewFacts } from './review';

const BASE: ReviewFacts = {
  sessionId: 'session' as SessionId,
  prNumber: 318,
  open: 0,
  ready: 0,
  accepted: 0,
  failed: 0,
  pushed: 0,
  notes: 0,
  isPushing: false,
  isLoading: false,
  isError: false,
};

type Row = {
  readonly name: string;
  readonly facts: Partial<ReviewFacts>;
  readonly expected: ReadonlyArray<string>;
};

const MATRIX: ReadonlyArray<Row> = [
  {
    name: '3 open, mixed',
    facts: { open: 3, ready: 1 },
    expected: [
      'review.openPullRequest link Open PR #318',
      'review.draftModel menu Model for drafts…',
    ],
  },
  {
    name: 'all decided, 2 accepted',
    facts: { accepted: 2 },
    expected: [
      'review.openPullRequest link Open PR #318',
      'review.push primary Push 2',
      'review.draftModel menu Model for drafts…',
    ],
  },
  {
    name: '1 open, 2 accepted',
    facts: { open: 1, accepted: 2 },
    expected: [
      'review.openPullRequest link Open PR #318',
      'review.push secondary Push 2',
      'review.draftModel menu Model for drafts…',
    ],
  },
  {
    name: 'pushing',
    facts: { accepted: 2, isPushing: true },
    expected: [
      'review.openPullRequest link Open PR #318',
      'review.push primary Push 2 (Pushing now.)',
      'review.draftModel menu Model for drafts…',
    ],
  },
  {
    name: 'all pushed',
    facts: { pushed: 3 },
    expected: [
      'review.openPullRequest link Open PR #318',
      'review.draftModel menu Model for drafts…',
    ],
  },
  {
    name: 'push failed for 1',
    facts: { accepted: 1, failed: 1, pushed: 2 },
    expected: [
      'review.openPullRequest link Open PR #318',
      'review.push primary Retry push for 1',
      'review.draftModel menu Model for drafts…',
    ],
  },
  {
    name: 'no comments',
    facts: {},
    expected: [
      'review.openPullRequest link Open PR #318',
      'review.draftModel menu Model for drafts…',
    ],
  },
  {
    name: 'no PR, 2 notes',
    facts: { prNumber: null, open: 2 },
    expected: ['review.draftModel menu Model for drafts…'],
  },
  {
    name: 'PR with open notes',
    facts: { notes: 2 },
    expected: [
      'review.openPullRequest link Open PR #318',
      'review.draftModel menu Model for drafts…',
      'review.postNotes menu Post open notes to the PR',
    ],
  },
  {
    name: 'loading',
    facts: { isLoading: true },
    expected: ['review.openPullRequest link Open PR #318'],
  },
  {
    name: 'GitHub unreachable',
    facts: { isError: true },
    expected: ['review.openPullRequest link Open PR #318', 'review.retryLoad empty Try again'],
  },
  {
    name: 'one drafting, 2 not started',
    facts: { open: 3 },
    expected: [
      'review.openPullRequest link Open PR #318',
      'review.draftModel menu Model for drafts…',
    ],
  },
];

const resolved = (facts: ReviewFacts) =>
  resolveActions({ definitions: REVIEW_KIND.actions, facts });

describe.each(MATRIX)('review, $name', ({ facts, expected }) => {
  const all = { ...BASE, ...facts };

  it('offers exactly the planned actions, in their slots', () => {
    expect(
      resolved(all).map(
        (action) =>
          `${action.id} ${action.slot} ${action.label}${action.blockedReason === null ? '' : ` (${action.blockedReason})`}`,
      ),
    ).toEqual(expected);
  });

  it('stays in budget: one primary at most, three secondaries at most', () => {
    const slots = resolved(all).map((action) => action.slot);
    expect(slots.filter((slot) => slot === 'primary').length).toBeLessThanOrEqual(1);
    expect(slots.filter((slot) => slot === 'secondary').length).toBeLessThanOrEqual(3);
  });
});
