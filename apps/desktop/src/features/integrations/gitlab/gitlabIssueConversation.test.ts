import { describe, expect, it } from 'vitest';
import type { GitlabIssueNote } from './client';
import { gitlabIssueConversation } from './gitlabIssueConversation';

type NoteParams = Partial<GitlabIssueNote> & { readonly id: number };

const note = ({ id, ...rest }: NoteParams): GitlabIssueNote => ({
  id,
  body: `note ${id}`,
  system: false,
  author: { username: 'ada', name: 'Ada Park', avatarUrl: 'https://gitlab.example/ada.png' },
  createdAt: '2026-07-22T10:00:00Z',
  ...rest,
});

describe('gitlabIssueConversation', () => {
  it('drops system notes, counts them and orders the rest oldest first', () => {
    const conversation = gitlabIssueConversation({
      notes: [
        note({ id: 1, createdAt: '2026-07-24T10:00:00Z' }),
        note({ id: 2, system: true }),
        note({ id: 3, createdAt: '2026-07-20T10:00:00Z' }),
      ],
    });

    expect(conversation.systemNoteCount).toBe(1);
    expect(conversation.threads.map((thread) => thread.id)).toEqual(['3', '1']);
  });

  it('keeps the author name and avatar on each flat message', () => {
    const [thread] = gitlabIssueConversation({ notes: [note({ id: 1 })] }).threads;

    expect(thread?.head.author).toEqual({
      name: 'Ada Park',
      avatarUrl: 'https://gitlab.example/ada.png',
      handle: null,
    });
    expect(thread?.replies).toEqual([]);
  });
});
