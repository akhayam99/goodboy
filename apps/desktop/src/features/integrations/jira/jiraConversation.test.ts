import { describe, expect, it } from 'vitest';
import type { JiraComment } from './client';
import { jiraConversation } from './jiraConversation';

type CommentParams = Partial<JiraComment> & { readonly id: string };

const comment = ({ id, ...rest }: CommentParams): JiraComment => ({
  id,
  author: null,
  body: `comment ${id}`,
  created: '2026-07-22T10:00:00Z',
  updated: '2026-07-22T10:00:00Z',
  ...rest,
});

describe('jiraConversation', () => {
  it('drops comments without readable text and says how many', () => {
    const conversation = jiraConversation({
      comments: [comment({ id: '1' }), comment({ id: '2', body: '  ' })],
    });

    expect(conversation.threads.map((thread) => thread.id)).toEqual(['1']);
    expect(conversation.footnote).toBe('1 comment has no readable text');
  });

  it('orders comments oldest first with no footnote when all are readable', () => {
    const conversation = jiraConversation({
      comments: [
        comment({ id: 'late', created: '2026-07-24T10:00:00Z' }),
        comment({ id: 'early', created: '2026-07-20T10:00:00Z' }),
      ],
    });

    expect(conversation.threads.map((thread) => thread.id)).toEqual(['early', 'late']);
    expect(conversation.footnote).toBeNull();
  });
});
