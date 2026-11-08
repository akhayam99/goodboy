import { describe, expect, it } from 'vitest';
import type { PrComment, PrDetail } from '@goodboy/types';
import type { ThreadEntry } from '../resolve/commentGroupsView';
import { pullRequestThreadCountsOf } from './pullRequestThreadCountsOf';

const HEAD: PrComment = {
  id: 'a',
  author: 'cascadia-lint[bot]',
  authorAvatarUrl: null,
  body: 'Retry cap check misses the 429 path',
  createdAt: '2026-11-07T10:00:00Z',
  url: 'https://github.com/northwind/payments-api/pull/318#a',
  source: 'review',
  resolved: false,
  threadId: 'thread-a',
};

const detailOf = ({ prNumber }: { readonly prNumber: number }): PrDetail => ({
  prNumber,
  comments: [HEAD, { ...HEAD, id: 'b', threadId: 'thread-b' }],
  reviews: [],
  reviewRequests: [],
  checks: [],
});

type EntryParams = {
  readonly threadId: string;
  readonly originKind: 'review_comment' | 'diff_comment';
};

const entryOf = ({ threadId, originKind }: EntryParams): ThreadEntry => ({
  threadId,
  resolveWord: 'open',
  row: { thread: { stage: 'new', state: 'open', stateReason: null, originKind } },
});

const LOADED: ReadonlyArray<ThreadEntry> = ['thread-a', 'thread-b'].map((threadId) =>
  entryOf({ threadId, originKind: 'review_comment' }),
);

const NOTE = entryOf({ threadId: 'note-a', originKind: 'diff_comment' });

const PR = { number: 318 };

describe('pullRequestThreadCountsOf', () => {
  it('reads the host review heads while no entry is loaded', () => {
    expect(
      pullRequestThreadCountsOf({
        pr: PR,
        detail: detailOf({ prNumber: 318 }),
        entries: [],
        isWithNotes: false,
      }),
    ).toEqual({ open: 2, resolved: 0, needYou: 2 });
  });

  it('gives the tab and the merge box the same numbers with and without the loaded entries', () => {
    const detail = detailOf({ prNumber: 318 });
    const tabOf = ({ entries }: { readonly entries: ReadonlyArray<ThreadEntry> }) =>
      pullRequestThreadCountsOf({ pr: PR, detail, entries, isWithNotes: true });
    const boxOf = ({ entries }: { readonly entries: ReadonlyArray<ThreadEntry> }) =>
      pullRequestThreadCountsOf({ pr: PR, detail, entries, isWithNotes: false });

    expect(tabOf({ entries: [] })).toEqual(boxOf({ entries: [] }));
    expect(tabOf({ entries: LOADED })).toEqual(boxOf({ entries: LOADED }));
    expect(tabOf({ entries: LOADED })).toEqual(tabOf({ entries: [] }));
  });

  it('adds the local notes on the tab and never in the merge box', () => {
    const params = { pr: PR, detail: detailOf({ prNumber: 318 }), entries: [...LOADED, NOTE] };

    expect(pullRequestThreadCountsOf({ ...params, isWithNotes: true }).open).toBe(3);
    expect(pullRequestThreadCountsOf({ ...params, isWithNotes: false }).open).toBe(2);
  });

  it('ignores a detail that belongs to another pull request', () => {
    expect(
      pullRequestThreadCountsOf({
        pr: PR,
        detail: detailOf({ prNumber: 412 }),
        entries: [],
        isWithNotes: true,
      }),
    ).toEqual({ open: 0, resolved: 0, needYou: 0 });
  });
});
