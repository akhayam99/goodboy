// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { resolveActions } from '../resolveActions';
import { REVIEW_KIND, type ReviewFacts } from './review';

const BASE: ReviewFacts = {
  sessionId: 'session' as SessionId,
  prNumber: 318,
  sourceKind: 'github',
  reviewTarget: { provider: 'github', repo: 'harborline/ledger-core', prNumber: 318 },
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
    expected: [],
  },
  {
    name: 'all decided, 2 accepted',
    facts: { accepted: 2 },
    expected: ['review.push primary Push 2'],
  },
  {
    name: '1 open, 2 accepted',
    facts: { open: 1, accepted: 2 },
    expected: ['review.push secondary Push 2'],
  },
  {
    name: 'pushing',
    facts: { accepted: 2, isPushing: true },
    expected: ['review.push primary Push 2 (Pushing now.)'],
  },
  {
    name: 'all pushed',
    facts: { pushed: 3 },
    expected: [],
  },
  {
    name: 'push failed for 1',
    facts: { accepted: 1, failed: 1, pushed: 2 },
    expected: ['review.push primary Retry push for 1'],
  },
  {
    name: 'no comments',
    facts: {},
    expected: [],
  },
  {
    name: 'no PR, 2 notes',
    facts: { prNumber: null, open: 2 },
    expected: [],
  },
  {
    name: 'PR with open notes',
    facts: { notes: 2 },
    expected: ['review.postNotes menu Move 2 to review draft'],
  },
  {
    name: 'open notes on a pull request that cannot take a draft',
    facts: { notes: 2, reviewTarget: null },
    expected: [],
  },
  {
    name: 'loading',
    facts: { isLoading: true },
    expected: [],
  },
  {
    name: 'GitHub unreachable',
    facts: { isError: true },
    expected: [],
  },
  {
    name: 'one drafting, 2 not started',
    facts: { open: 3 },
    expected: [],
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
