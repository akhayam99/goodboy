import { describe, expect, it } from 'vitest';
import type { GitlabMrDiscussion, GitlabMrNote } from './client';
import { gitlabIssueConversation } from './gitlabIssueConversation';

type NoteParams = Partial<GitlabMrNote> & { readonly id: number };

const note = ({ id, ...rest }: NoteParams): GitlabMrNote => ({
  id,
  body: `note ${id}`,
  system: false,
  author: { username: 'ada', name: 'Ada Park', avatarUrl: 'https://gitlab.example/ada.png' },
  createdAt: '2026-07-22T10:00:00Z',
  resolvable: false,
  resolved: null,
  position: null,
  ...rest,
});

const discussion = (id: string, notes: ReadonlyArray<GitlabMrNote>): GitlabMrDiscussion => ({
  id,
  individualNote: notes.length === 1,
  notes,
});

describe('gitlabIssueConversation', () => {
  it('drops system notes, counts them and orders the threads oldest first', () => {
    const conversation = gitlabIssueConversation({
      discussions: [
        discussion('d-1', [note({ id: 1, createdAt: '2026-07-24T10:00:00Z' })]),
        discussion('d-2', [note({ id: 2, system: true })]),
        discussion('d-3', [note({ id: 3, createdAt: '2026-07-20T10:00:00Z' })]),
      ],
    });

    expect(conversation.systemNoteCount).toBe(1);
    expect(conversation.threads.map((thread) => thread.id)).toEqual(['d-3', 'd-1']);
  });

  it('keys each thread by its discussion and keeps the replies in order', () => {
    const [thread] = gitlabIssueConversation({
      discussions: [
        discussion('d-1', [
          note({ id: 1 }),
          note({ id: 2, createdAt: '2026-07-22T11:00:00Z' }),
          note({ id: 3, createdAt: '2026-07-22T12:00:00Z' }),
        ]),
      ],
    }).threads;

    expect(thread?.id).toBe('d-1');
    expect(thread?.head.author).toEqual({
      name: 'Ada Park',
      avatarUrl: 'https://gitlab.example/ada.png',
      handle: null,
    });
    expect(thread?.replies.map((reply) => reply.id)).toEqual(['2', '3']);
    expect(thread?.anchor).toBeNull();
    expect(thread?.isResolved).toBeNull();
  });
});
