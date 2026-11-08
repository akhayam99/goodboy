// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ResolveStage } from '@goodboy/types';
import { branchTabFactsOf } from '../branch/branchTabFactsOf';
import {
  commentStateCountsOf,
  stateCountsInScopeOf,
  type CountableEntry,
} from './commentGroupsView';

type EntryParams = {
  readonly stage: ResolveStage;
  readonly originKind: 'diff_comment' | 'review_comment';
};

const entry = ({ stage, originKind }: EntryParams): CountableEntry => ({
  resolveWord: stage === 'resolved' || stage === 'parked' ? 'done' : 'open',
  row: { thread: { stage, state: 'open', stateReason: null, originKind } },
});

const MIXED = [
  entry({ stage: 'asking', originKind: 'review_comment' }),
  entry({ stage: 'working', originKind: 'diff_comment' }),
  entry({ stage: 'resolved', originKind: 'review_comment' }),
  entry({ stage: 'parked', originKind: 'diff_comment' }),
  entry({ stage: 'resolved', originKind: 'diff_comment' }),
];

type EntriesParams = {
  readonly entries: ReadonlyArray<CountableEntry>;
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
    const entries = [entry({ stage: 'working', originKind: 'review_comment' })];
    expect(commentStateCountsOf({ entries })).toEqual({ open: 1, resolved: 0, needYou: 0 });
  });

  it('moves a thread to resolved and back on undo', () => {
    const resolved = [
      entry({ stage: 'resolved', originKind: 'review_comment' }),
      ...MIXED.slice(1),
    ];
    expect(commentStateCountsOf({ entries: resolved })).toEqual({
      open: 1,
      resolved: 4,
      needYou: 0,
    });
    expect(commentStateCountsOf({ entries: MIXED })).toEqual({ open: 2, resolved: 3, needYou: 1 });
  });

  it('counts a thread left open on the host as open', () => {
    const leftOpen: CountableEntry = {
      resolveWord: 'left_open',
      row: {
        thread: { stage: 'parked', state: 'open', stateReason: null, originKind: 'review_comment' },
      },
    };
    expect(stateCountsInScopeOf({ entries: [leftOpen], scope: 'comments' })).toEqual({
      open: 1,
      resolved: 0,
      needYou: 0,
    });
  });

  it('keeps the open local notes out of the host count', () => {
    const thread = { state: 'open', stateReason: null } as const;
    const entries: ReadonlyArray<CountableEntry> = [
      {
        resolveWord: 'done',
        row: { thread: { ...thread, stage: 'resolved', originKind: 'review_comment' } },
      },
      {
        resolveWord: 'open',
        row: { thread: { ...thread, stage: 'new', originKind: 'diff_comment' } },
      },
      {
        resolveWord: 'open',
        row: { thread: { ...thread, stage: 'new', originKind: 'diff_comment' } },
      },
    ];
    expect(commentStateCountsOf({ entries }).open).toBe(2);
    expect(stateCountsInScopeOf({ entries, scope: 'comments' })).toEqual({
      open: 0,
      resolved: 1,
      needYou: 0,
    });
  });

  it('counts only the entries of the chosen source', () => {
    expect(stateCountsInScopeOf({ entries: MIXED, scope: 'notes' })).toEqual({
      open: 1,
      resolved: 2,
      needYou: 0,
    });
    expect(stateCountsInScopeOf({ entries: MIXED, scope: 'comments' })).toEqual({
      open: 1,
      resolved: 1,
      needYou: 1,
    });
    expect(stateCountsInScopeOf({ entries: MIXED, scope: 'branch' })).toEqual(
      commentStateCountsOf({ entries: MIXED }),
    );
  });
});
