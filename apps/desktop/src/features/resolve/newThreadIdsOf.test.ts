import { describe, expect, it } from 'vitest';
import type { PrComment, ResolveStage } from '@goodboy/types';
import type { CommentThread } from '../integrations/github/comment-threads';
import { commentsCountOf } from './commentsCountOf';
import { newThreadIdsOf } from './newThreadIdsOf';

const NOON = Date.parse('2026-10-30T12:00:00Z');
const MINUTE = 60_000;
const ME: ReadonlySet<string> = new Set(['harborline-dev']);

type CommentParams = {
  readonly id: string;
  readonly author: string;
  readonly at: number | null;
};

const commentOf = ({ id, author, at }: CommentParams): PrComment => ({
  id,
  author,
  authorAvatarUrl: null,
  body: 'Please rename this in ledger-core',
  createdAt: at === null ? '' : new Date(at).toISOString(),
  url: `https://example.test/${id}`,
  source: 'review',
});

type EntryParams = {
  readonly threadId: string;
  readonly stage?: ResolveStage;
  readonly comments?: ReadonlyArray<PrComment>;
  readonly originKind?: 'review_comment' | 'diff_comment';
};

const entryOf = ({
  threadId,
  stage = 'new',
  comments = [],
  originKind = 'review_comment',
}: EntryParams) => {
  const [head, ...replies] = comments;
  const commentThread: CommentThread | null = head === undefined ? null : { head, replies };
  return { thread: { threadId, stage, originKind }, commentThread };
};

const idsOf = ({
  entries,
  reads = {},
  viewerLogins = ME,
}: {
  readonly entries: ReadonlyArray<ReturnType<typeof entryOf>>;
  readonly reads?: Readonly<Record<string, number>>;
  readonly viewerLogins?: ReadonlySet<string>;
}): ReadonlyArray<string> => [...newThreadIdsOf({ entries, reads, viewerLogins })];

describe('newThreadIdsOf', () => {
  it('counts a thread the user never read', () => {
    const entries = [
      entryOf({
        threadId: 'a',
        comments: [commentOf({ id: 'c1', author: 'northwind-rev', at: NOON })],
      }),
    ];

    expect(idsOf({ entries })).toEqual(['a']);
  });

  it('keeps a read thread quiet until someone else writes after the read', () => {
    const entries = [
      entryOf({
        threadId: 'a',
        comments: [
          commentOf({ id: 'c1', author: 'northwind-rev', at: NOON }),
          commentOf({ id: 'c2', author: 'northwind-rev', at: NOON + 5 * MINUTE }),
        ],
      }),
    ];

    expect(idsOf({ entries, reads: { a: NOON + 6 * MINUTE } })).toEqual([]);
    expect(idsOf({ entries, reads: { a: NOON + 2 * MINUTE } })).toEqual(['a']);
  });

  it('never makes a thread new for a reply the user wrote', () => {
    const entries = [
      entryOf({
        threadId: 'a',
        comments: [
          commentOf({ id: 'c1', author: 'northwind-rev', at: NOON }),
          commentOf({ id: 'c2', author: 'Harborline-Dev', at: NOON + 9 * MINUTE }),
        ],
      }),
    ];

    expect(idsOf({ entries, reads: { a: NOON + MINUTE } })).toEqual([]);
  });

  it('never counts a settled thread or a local note', () => {
    const entries = [
      entryOf({ threadId: 'done', stage: 'resolved' }),
      entryOf({ threadId: 'parked', stage: 'parked' }),
      entryOf({ threadId: 'note', originKind: 'diff_comment' }),
    ];

    expect(idsOf({ entries })).toEqual([]);
  });

  it('keeps a thread with no author time new until it is read once', () => {
    const entries = [
      entryOf({
        threadId: 'a',
        comments: [commentOf({ id: 'c1', author: 'acme-bot', at: null })],
      }),
      entryOf({ threadId: 'b' }),
    ];

    expect(idsOf({ entries })).toEqual(['a', 'b']);
    expect(idsOf({ entries, reads: { a: NOON, b: NOON } })).toEqual([]);
  });

  it('counts every comment as someone else when the host gives no viewer login', () => {
    const entries = [
      entryOf({
        threadId: 'a',
        comments: [commentOf({ id: 'c1', author: 'harborline-dev', at: NOON + MINUTE })],
      }),
    ];

    expect(idsOf({ entries, reads: { a: NOON }, viewerLogins: new Set() })).toEqual(['a']);
  });
});

describe('commentsCountOf new count', () => {
  const thread = (threadId: string, stage: ResolveStage) => ({
    threadId,
    stage,
    state: 'open' as const,
    stateReason: null,
  });

  it('counts only open threads that are in the new set', () => {
    const count = commentsCountOf({
      threads: [thread('a', 'new'), thread('b', 'asking'), thread('c', 'resolved')],
      newThreadIds: new Set(['a', 'c']),
    });

    expect(count.newCount).toBe(1);
    expect(count.unresolved).toBe(2);
    expect(count.needsYou).toBe(1);
  });

  it('is zero when no set is given', () => {
    expect(commentsCountOf({ threads: [thread('a', 'new')] }).newCount).toBe(0);
  });
});
