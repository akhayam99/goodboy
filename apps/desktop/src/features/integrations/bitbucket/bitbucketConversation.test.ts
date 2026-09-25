import { describe, expect, it } from 'vitest';
import type { BitbucketComment } from './client';
import { bitbucketConversation } from './bitbucketConversation';

type CommentParams = Partial<BitbucketComment> & { readonly id: number };

const comment = ({ id, ...rest }: CommentParams): BitbucketComment => ({
  id,
  body: `comment ${id}`,
  user: {
    uuid: '{u1}',
    accountId: null,
    nickname: 'priya',
    displayName: 'Priya Moss',
    avatarUrl: null,
  },
  createdOn: '2026-07-22T10:00:00Z',
  updatedOn: '2026-07-22T10:00:00Z',
  deleted: false,
  parentId: null,
  inline: null,
  webUrl: null,
  ...rest,
});

describe('bitbucketConversation', () => {
  it('flattens nested replies under their root thread', () => {
    const threads = bitbucketConversation({
      comments: [
        comment({ id: 1 }),
        comment({ id: 2, parentId: 1 }),
        comment({ id: 3, parentId: 2 }),
      ],
    });

    expect(threads).toHaveLength(1);
    expect(threads[0]?.id).toBe('1');
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual(['2', '3']);
  });

  it('anchors an inline comment to its path and line', () => {
    const [thread] = bitbucketConversation({
      comments: [comment({ id: 1, inline: { path: 'src/refunds.ts', from: null, to: 12 } })],
    });

    expect(thread?.anchor).toBe('src/refunds.ts:12');
    expect(thread?.isResolved).toBeNull();
  });
});
