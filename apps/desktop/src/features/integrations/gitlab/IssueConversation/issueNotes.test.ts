import { describe, expect, it } from 'vitest';
import type { GitlabIssueNote } from '../client';
import { buildIssueConversation } from './issueNotes';

type NoteParams = Partial<GitlabIssueNote> & { readonly id: number };

const note = ({ id, ...rest }: NoteParams): GitlabIssueNote => ({
  id,
  body: `note ${id}`,
  system: false,
  author: { username: 'alice', name: 'Alice', avatarUrl: null },
  createdAt: '2026-07-22T10:00:00Z',
  ...rest,
});

describe('buildIssueConversation', () => {
  it('drops system notes and counts them', () => {
    const conversation = buildIssueConversation({
      notes: [
        note({ id: 1, body: 'tighten this' }),
        note({ id: 2, body: 'changed milestone to v2', system: true }),
        note({ id: 3, body: 'done' }),
      ],
    });

    expect(conversation.systemNoteCount).toBe(1);
    expect(conversation.notes.map((n) => n.body)).toEqual(['tighten this', 'done']);
  });

  it('returns an empty conversation when every note is a system note', () => {
    const conversation = buildIssueConversation({
      notes: [note({ id: 1, body: 'assigned to bob', system: true })],
    });

    expect(conversation.notes).toHaveLength(0);
    expect(conversation.systemNoteCount).toBe(1);
  });

  it('sorts notes oldest first for a chronological conversation', () => {
    const conversation = buildIssueConversation({
      notes: [
        note({ id: 1, createdAt: '2026-07-24T10:00:00Z' }),
        note({ id: 2, createdAt: '2026-07-20T10:00:00Z' }),
      ],
    });

    expect(conversation.notes.map((n) => n.id)).toEqual([2, 1]);
  });
});
