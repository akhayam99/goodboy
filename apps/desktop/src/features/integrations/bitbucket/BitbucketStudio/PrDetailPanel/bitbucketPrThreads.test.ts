import { describe, expect, it } from 'vitest';
import type { BitbucketComment } from '../../client';
import { bitbucketPrThreads } from './bitbucketPrThreads';

const comment = (id: number, parentId: number | null): BitbucketComment => ({
  id,
  body: `comment ${id}`,
  user: null,
  createdOn: '2026-08-01T10:00:00Z',
  updatedOn: '2026-08-01T10:00:00Z',
  deleted: false,
  parentId,
  inline: null,
  webUrl: null,
});

describe('bitbucketPrThreads', () => {
  it('hangs replies under the comment they answer', () => {
    const threads = bitbucketPrThreads({
      comments: [comment(1, null), comment(2, 1), comment(3, null)],
    });
    expect(threads.map((thread) => thread.head.id)).toEqual([1, 3]);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual([2]);
  });

  it('lifts a reply to a reply onto the same thread', () => {
    const threads = bitbucketPrThreads({
      comments: [comment(1, null), comment(2, 1), comment(3, 2)],
    });
    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual([2, 3]);
  });

  it('keeps a reply whose parent is missing as its own thread', () => {
    const threads = bitbucketPrThreads({ comments: [comment(9, 4)] });
    expect(threads.map((thread) => thread.head.id)).toEqual([9]);
  });
});
