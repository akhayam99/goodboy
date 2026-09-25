import { describe, expect, it } from 'vitest';
import type { GithubIssueComment } from '@goodboy/types';
import { githubIssueConversation } from './githubIssueConversation';

const comment = (id: string, createdAt: string): GithubIssueComment => ({
  id,
  author: 'leo-t',
  authorAvatarUrl: null,
  body: `comment ${id}`,
  createdAt,
  url: `https://example.invalid/acme/ledger-core/issues/1#${id}`,
});

describe('githubIssueConversation', () => {
  it('turns each comment into a flat thread, oldest first', () => {
    const threads = githubIssueConversation({
      comments: [comment('b', '2026-07-24T10:00:00Z'), comment('a', '2026-07-20T10:00:00Z')],
    });

    expect(threads.map((thread) => thread.id)).toEqual(['a', 'b']);
    expect(threads[0]?.replies).toEqual([]);
  });

  it('keeps the login as the handle a quote mentions', () => {
    const [thread] = githubIssueConversation({ comments: [comment('a', '2026-07-20T10:00:00Z')] });

    expect(thread?.head.author.handle).toBe('leo-t');
  });
});
