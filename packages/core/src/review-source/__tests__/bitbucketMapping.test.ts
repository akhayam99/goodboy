import { describe, expect, it } from 'vitest';
import {
  bitbucketCommentId,
  bitbucketThreadId,
  bitbucketThreadsOf,
  type BitbucketReviewComment,
} from '../bitbucketReviewSource';
import { commitLinkOf } from '../commitLink';
import { REVIEW_SOURCE_CAPABILITIES } from '../types';

const comment = (overrides: Partial<BitbucketReviewComment> = {}): BitbucketReviewComment => ({
  id: 1,
  body: 'Use the shared formatter',
  user: { nickname: 'theo', displayName: 'Theo Varga', avatarUrl: null },
  createdOn: '2026-01-01T10:00:00Z',
  deleted: false,
  parentId: null,
  inline: { path: 'src/checkout/format.ts', from: null, to: 12 },
  webUrl: null,
  ...overrides,
});

describe('bitbucketThreadsOf', () => {
  it('groups replies under their root and keeps the order of posting', () => {
    const [thread] = bitbucketThreadsOf({
      prUrl: null,
      comments: [
        comment({ id: 3, parentId: 2, inline: null, createdOn: '2026-01-01T10:20:00Z' }),
        comment({ id: 2, parentId: 1, inline: null, createdOn: '2026-01-01T10:10:00Z' }),
        comment({ id: 1 }),
      ],
    });
    expect(thread?.threadId).toBe('bitbucket:1');
    expect(thread?.providerThreadId).toBe('1');
    expect(thread?.comments.map((entry) => entry.id)).toEqual(['1', '2', '3']);
  });

  it('gives replies the file and line of the root', () => {
    const [thread] = bitbucketThreadsOf({
      prUrl: null,
      comments: [comment(), comment({ id: 2, parentId: 1, inline: null })],
    });
    expect(thread?.comments.map((entry) => [entry.path, entry.line])).toEqual([
      ['src/checkout/format.ts', 12],
      ['src/checkout/format.ts', 12],
    ]);
  });

  it('skips pull request level comments and deleted threads', () => {
    const threads = bitbucketThreadsOf({
      prUrl: null,
      comments: [
        comment({ id: 1, inline: null }),
        comment({ id: 2, deleted: true }),
        comment({ id: 3, parentId: 2, inline: null }),
        comment({ id: 4 }),
        comment({ id: 5, parentId: 4, deleted: true, inline: null }),
      ],
    });
    expect(threads.map((thread) => thread.threadId)).toEqual(['bitbucket:4']);
    expect(threads[0]?.comments).toHaveLength(1);
  });

  it('never marks a thread resolved or resolvable', () => {
    const [thread] = bitbucketThreadsOf({ prUrl: null, comments: [comment()] });
    expect(thread?.isResolved).toBe(false);
    expect(thread?.comments[0]?.canResolve).toBe(false);
    expect(thread?.comments[0]?.source).toBe('review');
  });

  it('builds a comment link from the pull request when the API sends none', () => {
    const [thread] = bitbucketThreadsOf({
      prUrl: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12',
      comments: [comment()],
    });
    expect(thread?.comments[0]?.url).toBe(
      'https://bitbucket.org/northwind/storefront-web/pull-requests/12#comment-1',
    );
  });

  it('survives a reply whose parent is missing from the page', () => {
    const threads = bitbucketThreadsOf({
      prUrl: null,
      comments: [comment({ id: 8, parentId: 7, inline: null })],
    });
    expect(threads).toEqual([]);
  });
});

describe('bitbucket ids and links', () => {
  it('round trips the thread id', () => {
    expect(bitbucketCommentId({ threadId: bitbucketThreadId({ commentId: 4001 }) })).toBe('4001');
    expect(bitbucketCommentId({ threadId: '4001' })).toBe('4001');
  });

  it('links a commit and gives up on a foreign url', () => {
    expect(
      commitLinkOf({
        kind: 'bitbucket',
        url: 'https://bitbucket.org/northwind/storefront-web/pull-requests/12/diff',
        sha: 'abc',
      }),
    ).toBe('https://bitbucket.org/northwind/storefront-web/commits/abc');
    expect(
      commitLinkOf({ kind: 'bitbucket', url: 'https://example.com/x', sha: 'abc' }),
    ).toBeNull();
  });
});

describe('bitbucket pull request capabilities', () => {
  it('flips what the adapter backs and keeps the rest honest', () => {
    expect(REVIEW_SOURCE_CAPABILITIES.bitbucket).toEqual({
      canReply: true,
      canResolve: false,
      canEditTitle: true,
      canEditBody: true,
      canRequestReviewers: true,
      canSetDraft: false,
      canReadChecks: true,
      canChooseMergeMethod: true,
      canClose: true,
      canReopen: false,
    });
  });
});
