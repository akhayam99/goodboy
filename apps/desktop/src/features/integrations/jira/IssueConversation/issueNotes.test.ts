import { describe, expect, it } from 'vitest';
import type { JiraComment } from '../client';
import { buildIssueConversation } from './issueNotes';

const comment = (overrides: Partial<JiraComment>): JiraComment =>
  ({
    id: '1',
    author: null,
    body: 'Looks good',
    created: '2026-07-01T10:00:00.000Z',
    updated: '2026-07-01T10:00:00.000Z',
    ...overrides,
  }) as JiraComment;

describe('buildIssueConversation', () => {
  it('sorts comments oldest first', () => {
    const conversation = buildIssueConversation({
      comments: [
        comment({ id: 'b', created: '2026-07-02T10:00:00.000Z' }),
        comment({ id: 'a', created: '2026-07-01T10:00:00.000Z' }),
      ],
    });
    expect(conversation.comments.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('counts comments whose body carried no readable text instead of showing them empty', () => {
    const conversation = buildIssueConversation({
      comments: [comment({ id: 'a' }), comment({ id: 'b', body: '   ' })],
    });
    expect(conversation.comments.map((entry) => entry.id)).toEqual(['a']);
    expect(conversation.emptyCommentCount).toBe(1);
  });
});
