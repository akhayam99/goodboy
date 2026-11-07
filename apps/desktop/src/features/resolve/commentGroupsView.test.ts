// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import { branchTabFactsOf } from '../branch/branchTabFactsOf';
import { commentStateCountsOf, groupsInViewOf } from './commentGroupsView';
import type { ReviewEntry, ReviewGroup } from './components/ReviewFlow/useReviewEntries';

type EntryParams = {
  readonly stage: ResolveStage;
  readonly originKind: 'diff_comment' | 'review_thread';
};

const entry = ({ stage, originKind }: EntryParams): ReviewEntry =>
  ({
    resolveWord: stage === 'resolved' || stage === 'parked' ? 'done' : 'open',
    row: { thread: { stage, state: 'open', stateReason: null, originKind } },
  }) as unknown as ReviewEntry;

const MIXED = [
  entry({ stage: 'asking', originKind: 'review_thread' }),
  entry({ stage: 'working', originKind: 'diff_comment' }),
  entry({ stage: 'resolved', originKind: 'review_thread' }),
  entry({ stage: 'parked', originKind: 'diff_comment' }),
  entry({ stage: 'resolved', originKind: 'diff_comment' }),
];

type EntriesParams = {
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const tabCountOf = ({ entries }: EntriesParams): number | null => {
  const counts = commentStateCountsOf({ entries });
  return branchTabFactsOf({
    pullRequestState: 'open',
    commentsNeedYou: counts.needYou,
    commentsOpen: counts.open,
    files: null,
    diff: null,
    commits: null,
    notPushed: null,
    checks: null,
    checksUnreadReason: null,
  }).comments.count;
};

describe('commentStateCountsOf', () => {
  it('counts open and resolved for host and local notes together', () => {
    expect(commentStateCountsOf({ entries: MIXED })).toEqual({ open: 2, resolved: 3, needYou: 1 });
  });

  it('agrees with the Comments tab count', () => {
    expect(commentStateCountsOf({ entries: MIXED }).open).toBe(tabCountOf({ entries: MIXED }));
  });

  it('counts from the first thread on', () => {
    const entries = [entry({ stage: 'working', originKind: 'review_thread' })];
    expect(commentStateCountsOf({ entries })).toEqual({ open: 1, resolved: 0, needYou: 0 });
  });

  it('moves a thread to resolved and back on undo', () => {
    const resolved = [entry({ stage: 'resolved', originKind: 'review_thread' }), ...MIXED.slice(1)];
    expect(commentStateCountsOf({ entries: resolved })).toEqual({
      open: 1,
      resolved: 4,
      needYou: 0,
    });
    expect(commentStateCountsOf({ entries: MIXED })).toEqual({ open: 2, resolved: 3, needYou: 1 });
  });

  it('lists exactly the entries each count claims', () => {
    const groups: ReadonlyArray<ReviewGroup> = [{ group: 'needs_you', entries: MIXED }];
    const counts = commentStateCountsOf({ entries: MIXED });
    const shown = (state: 'open' | 'resolved') =>
      groupsInViewOf({ groups, scope: 'branch', state }).flatMap((g) => g.entries).length;
    expect(shown('open')).toBe(counts.open);
    expect(shown('resolved')).toBe(counts.resolved);
  });
});
