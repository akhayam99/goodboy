import { describe, expect, it } from 'vitest';
import type { PrComment, ResolveStage, ResolveThread } from '@goodboy/types';
import { queueRowAt } from '../../../features/resolve/testing/queueRow';
import { unreadThreadsOf } from './unreadThreadsOf';

const NOON = Date.parse('2026-10-30T12:00:00Z');
const MINUTE = 60_000;
const ME: ReadonlySet<string> = new Set(['harborline-dev']);
const ENTRY = { kind: 'github', projectId: null, number: 41 } as const;

type CommentParams = {
  readonly id: string;
  readonly threadId: string;
  readonly author: string;
  readonly at: number | null;
};

const commentOf = ({ id, threadId, author, at }: CommentParams): PrComment => ({
  id,
  threadId,
  author,
  authorAvatarUrl: null,
  body: 'Please rename this in ledger-core',
  createdAt: at === null ? '' : new Date(at).toISOString(),
  url: `https://example.test/${id}`,
  source: 'review',
});

type ThreadParams = {
  readonly threadId: string;
  readonly stage?: ResolveStage;
  readonly originKind?: ResolveThread['originKind'];
  readonly prNumber?: number | null;
};

const threadOf = ({
  threadId,
  stage = 'new',
  originKind = 'review_comment',
  prNumber = 41,
}: ThreadParams): ResolveThread => ({
  ...queueRowAt({ stage, threadId, originKind }).thread,
  prNumber,
  projectId: null,
});

type Params = {
  readonly threads: ReadonlyArray<ResolveThread>;
  readonly comments?: ReadonlyArray<PrComment>;
  readonly reads?: Readonly<Record<string, number>> | undefined;
  readonly viewerLogins?: ReadonlySet<string> | null;
};

const idsOf = ({
  threads,
  comments = [],
  reads = {},
  viewerLogins = ME,
}: Params): ReadonlyArray<string> | null =>
  unreadThreadsOf({ threads, comments, entry: ENTRY, reads, viewerLogins })?.map(
    ({ threadId }) => threadId,
  ) ?? null;

describe('unreadThreadsOf', () => {
  it('counts a thread the user never read', () => {
    const comments = [commentOf({ id: 'c1', threadId: 'a', author: 'northwind-rev', at: NOON })];

    expect(idsOf({ threads: [threadOf({ threadId: 'a' })], comments })).toEqual(['a']);
  });

  it('keeps a read thread quiet until someone else writes after the read', () => {
    const threads = [threadOf({ threadId: 'a' })];
    const comments = [
      commentOf({ id: 'c1', threadId: 'a', author: 'northwind-rev', at: NOON }),
      commentOf({ id: 'c2', threadId: 'a', author: 'northwind-rev', at: NOON + 5 * MINUTE }),
    ];

    expect(idsOf({ threads, comments, reads: { a: NOON + 6 * MINUTE } })).toEqual([]);
    expect(idsOf({ threads, comments, reads: { a: NOON + 2 * MINUTE } })).toEqual(['a']);
  });

  it('never makes a thread unread for a reply the user wrote', () => {
    const comments = [
      commentOf({ id: 'c1', threadId: 'a', author: 'northwind-rev', at: NOON }),
      commentOf({ id: 'c2', threadId: 'a', author: 'Harborline-Dev', at: NOON + 9 * MINUTE }),
    ];

    expect(
      idsOf({ threads: [threadOf({ threadId: 'a' })], comments, reads: { a: NOON + MINUTE } }),
    ).toEqual([]);
  });

  it('never counts a thread whose comments are all the user own, read or not', () => {
    const comments = [
      commentOf({ id: 'c1', threadId: 'a', author: 'harborline-dev', at: NOON }),
      commentOf({ id: 'c2', threadId: 'a', author: 'harborline-dev', at: NOON + MINUTE }),
    ];

    expect(idsOf({ threads: [threadOf({ threadId: 'a' })], comments })).toEqual([]);
  });

  it('never counts a settled thread or a local note', () => {
    const threads = [
      threadOf({ threadId: 'done', stage: 'resolved' }),
      threadOf({ threadId: 'parked', stage: 'parked' }),
      threadOf({ threadId: 'note', originKind: 'diff_comment' }),
    ];

    expect(idsOf({ threads })).toEqual([]);
  });

  it('counts only the threads the Comments tab of the selected source lists', () => {
    const threads = [threadOf({ threadId: 'here' }), threadOf({ threadId: 'other', prNumber: 52 })];

    expect(idsOf({ threads })).toEqual(['here']);
  });

  it('keeps a thread with no author time unread until it is read once', () => {
    const threads = [threadOf({ threadId: 'a' }), threadOf({ threadId: 'b' })];
    const comments = [commentOf({ id: 'c1', threadId: 'a', author: 'acme-bot', at: null })];

    expect(idsOf({ threads, comments })).toEqual(['a', 'b']);
    expect(idsOf({ threads, comments, reads: { a: NOON, b: NOON } })).toEqual([]);
  });

  it('reports the latest time written by someone else for the read mark', () => {
    const comments = [
      commentOf({ id: 'c1', threadId: 'a', author: 'northwind-rev', at: NOON }),
      commentOf({ id: 'c2', threadId: 'a', author: 'harborline-dev', at: NOON + 9 * MINUTE }),
      commentOf({ id: 'c3', threadId: 'a', author: 'northwind-rev', at: NOON + 3 * MINUTE }),
    ];

    const [unread] = unreadThreadsOf({
      threads: [threadOf({ threadId: 'a' })],
      comments,
      entry: ENTRY,
      reads: {},
      viewerLogins: ME,
    }) ?? [null];

    expect(unread?.latestOtherMs).toBe(NOON + 3 * MINUTE);
  });

  it('is not loaded before the reads or the viewer identity are known', () => {
    const threads = [threadOf({ threadId: 'a' })];

    const base = { threads, comments: [], entry: ENTRY };

    expect(unreadThreadsOf({ ...base, reads: undefined, viewerLogins: ME })).toBeNull();
    expect(unreadThreadsOf({ ...base, reads: {}, viewerLogins: null })).toBeNull();
  });
});
