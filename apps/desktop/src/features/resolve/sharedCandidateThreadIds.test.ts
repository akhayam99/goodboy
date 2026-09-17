import { describe, expect, it } from 'vitest';
import type { ResolveCandidateWithItems } from '../../store/slices/resolve/state';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import {
  sharedCandidateBlocker,
  sharedCandidateThreadIds,
  type SharedCandidateMember,
} from './sharedCandidateThreadIds';

type RowSeed = Readonly<{
  itemId: string;
  threadId: string;
  body: string;
  approvalState?: SharedCandidateMember['approvalState'];
}>;

const rowOf = ({ itemId, threadId, body, approvalState = 'none' }: RowSeed): ResolveQueueRow =>
  ({
    item: { id: itemId, approvalState },
    thread: { threadId },
    reviewerNote: { body },
  }) as unknown as ResolveQueueRow;

type CandidateSeed = Readonly<{
  id: string;
  state: string;
  itemIds: ReadonlyArray<string>;
}>;

const candidateOf = ({ id, state, itemIds }: CandidateSeed): ResolveCandidateWithItems =>
  ({
    candidate: { id, state },
    items: itemIds.map((queueItemId) => ({ candidateId: id, queueItemId, itemRevision: 1 })),
  }) as unknown as ResolveCandidateWithItems;

const rows = [
  rowOf({ itemId: 'i-1', threadId: 't-1', body: 'The retry has no jitter.' }),
  rowOf({ itemId: 'i-2', threadId: 't-2', body: 'The metric name is wrong.' }),
  rowOf({ itemId: 'i-3', threadId: 't-3', body: 'This log leaks the token.' }),
];

describe('sharedCandidateThreadIds', () => {
  it('names the other comments one approval would carry', () => {
    const candidates = [candidateOf({ id: 'c-1', state: 'ready', itemIds: ['i-1', 'i-2'] })];

    expect(sharedCandidateThreadIds({ queueItemId: 'i-1', candidates, rows })).toEqual([
      {
        queueItemId: 'i-2',
        threadId: 't-2',
        title: 'The metric name is wrong.',
        approvalState: 'none',
      },
    ]);
  });

  it('says nothing when the change covers this comment alone', () => {
    const candidates = [candidateOf({ id: 'c-1', state: 'ready', itemIds: ['i-1'] })];

    expect(sharedCandidateThreadIds({ queueItemId: 'i-1', candidates, rows })).toEqual([]);
  });

  it('ignores a candidate that is not ready, the way the approval does', () => {
    const candidates = [candidateOf({ id: 'c-1', state: 'building', itemIds: ['i-1', 'i-2'] })];

    expect(sharedCandidateThreadIds({ queueItemId: 'i-1', candidates, rows })).toEqual([]);
  });

  it('drops a member the queue no longer lists instead of naming a ghost', () => {
    const candidates = [candidateOf({ id: 'c-1', state: 'ready', itemIds: ['i-1', 'i-gone'] })];

    expect(sharedCandidateThreadIds({ queueItemId: 'i-1', candidates, rows })).toEqual([]);
  });

  it('takes the last ready candidate when several hold the same item', () => {
    const candidates = [
      candidateOf({ id: 'c-1', state: 'ready', itemIds: ['i-1', 'i-2'] }),
      candidateOf({ id: 'c-2', state: 'ready', itemIds: ['i-1', 'i-3'] }),
    ];

    expect(
      sharedCandidateThreadIds({ queueItemId: 'i-1', candidates, rows }).map(
        (member) => member.threadId,
      ),
    ).toEqual(['t-3']);
  });
});

describe('sharedCandidateBlocker', () => {
  it('reports a sibling the user parked for later', () => {
    const candidates = [candidateOf({ id: 'c-1', state: 'ready', itemIds: ['i-1', 'i-2'] })];
    const parked = [
      rows[0]!,
      rowOf({ itemId: 'i-2', threadId: 't-2', body: 'x', approvalState: 'deferred' }),
    ];

    expect(
      sharedCandidateBlocker({
        members: sharedCandidateThreadIds({ queueItemId: 'i-1', candidates, rows: parked }),
      }),
    ).toBe('deferred');
  });

  it('reports a sibling the user refused', () => {
    const candidates = [candidateOf({ id: 'c-1', state: 'ready', itemIds: ['i-1', 'i-2'] })];
    const refused = [
      rows[0]!,
      rowOf({ itemId: 'i-2', threadId: 't-2', body: 'x', approvalState: 'wont_fix' }),
    ];

    expect(
      sharedCandidateBlocker({
        members: sharedCandidateThreadIds({ queueItemId: 'i-1', candidates, rows: refused }),
      }),
    ).toBe('wont_fix');
  });

  it('reports nothing when every sibling is still undecided', () => {
    const candidates = [candidateOf({ id: 'c-1', state: 'ready', itemIds: ['i-1', 'i-2'] })];

    expect(
      sharedCandidateBlocker({
        members: sharedCandidateThreadIds({ queueItemId: 'i-1', candidates, rows }),
      }),
    ).toBeNull();
  });
});
