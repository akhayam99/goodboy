import { describe, expect, it } from 'vitest';
import type { LinearIssueComment } from './client';
import { linearConversation } from './linearConversation';
import { linearThreads } from './linearThreads';

const comment = ({
  id,
  at,
  parentId = null,
}: {
  id: string;
  at: string;
  parentId?: string | null;
}): LinearIssueComment => ({
  id,
  body: `body ${id}`,
  createdAt: `2026-09-20T10:${at}:00Z`,
  parent: parentId == null ? null : { id: parentId },
  user: { name: 'Robin Vale', avatarUrl: 'https://linear.example/robin.png' },
});

describe('linearThreads', () => {
  it('groups replies under their root in the order they were written', () => {
    const threads = linearThreads({
      comments: [
        comment({ id: 'c3', at: '03', parentId: 'c1' }),
        comment({ id: 'c1', at: '01' }),
        comment({ id: 'c2', at: '02' }),
        comment({ id: 'c4', at: '04', parentId: 'c1' }),
      ],
    });

    expect(threads.map((thread) => thread.head.id)).toEqual(['c1', 'c2']);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual(['c3', 'c4']);
    expect(threads[1]?.replies).toEqual([]);
  });

  it('folds a reply to a reply into the root thread', () => {
    const threads = linearThreads({
      comments: [
        comment({ id: 'c1', at: '01' }),
        comment({ id: 'c2', at: '02', parentId: 'c1' }),
        comment({ id: 'c3', at: '03', parentId: 'c2' }),
      ],
    });

    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies.map((reply) => reply.id)).toEqual(['c2', 'c3']);
  });

  it('treats a comment whose parent is missing as a root', () => {
    const threads = linearThreads({
      comments: [
        comment({ id: 'c1', at: '01' }),
        comment({ id: 'c2', at: '02', parentId: 'gone' }),
      ],
    });

    expect(threads.map((thread) => thread.head.id)).toEqual(['c1', 'c2']);
  });
});

describe('linearConversation', () => {
  it('keys each thread by its root and carries the author avatar', () => {
    const [thread] = linearConversation({
      comments: [comment({ id: 'c1', at: '01' }), comment({ id: 'c2', at: '02', parentId: 'c1' })],
    });

    expect(thread?.id).toBe('c1');
    expect(thread?.head.author.avatarUrl).toBe('https://linear.example/robin.png');
    expect(thread?.replies.map((reply) => reply.id)).toEqual(['c2']);
    expect(thread?.isResolved).toBeNull();
  });
});
