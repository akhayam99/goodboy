import { describe, expect, it } from 'vitest';
import type { GitlabMrDiscussion, GitlabMrNote } from './client';
import { gitlabMrConversation } from './gitlabMrConversation';

type NoteParams = Partial<GitlabMrNote> & { readonly id: number };

type DiscussionParams = {
  readonly id: string;
  readonly notes: ReadonlyArray<GitlabMrNote>;
};

const note = ({ id, ...rest }: NoteParams): GitlabMrNote => ({
  id,
  body: `note ${id}`,
  system: false,
  author: { username: 'robin', name: 'Robin Vale', avatarUrl: null },
  createdAt: '2026-07-22T10:00:00Z',
  resolvable: false,
  resolved: null,
  position: null,
  ...rest,
});

const discussion = ({ id, notes }: DiscussionParams): GitlabMrDiscussion => ({
  id,
  individualNote: false,
  notes,
});

describe('gitlabMrConversation', () => {
  it('drops system notes, counts them and keeps head plus replies', () => {
    const conversation = gitlabMrConversation({
      discussions: [
        discussion({
          id: 'a',
          notes: [
            note({ id: 1, body: 'tighten this' }),
            note({ id: 2, body: 'changed the title', system: true }),
            note({ id: 3, body: 'done' }),
          ],
        }),
        discussion({ id: 'b', notes: [note({ id: 4, system: true })] }),
      ],
    });

    expect(conversation.systemNoteCount).toBe(2);
    expect(conversation.threads).toHaveLength(1);
    expect(conversation.threads[0]?.head.body).toBe('tighten this');
    expect(conversation.threads[0]?.replies.map((reply) => reply.body)).toEqual(['done']);
  });

  it('resolves a thread only when every resolvable note is resolved, null when none can be', () => {
    const conversation = gitlabMrConversation({
      discussions: [
        discussion({
          id: 'a',
          notes: [
            note({ id: 1, resolvable: true, resolved: true }),
            note({ id: 2, resolvable: true, resolved: false }),
          ],
        }),
        discussion({ id: 'b', notes: [note({ id: 3, resolvable: true, resolved: true })] }),
        discussion({ id: 'c', notes: [note({ id: 4 })] }),
      ],
    });

    const byId = new Map(conversation.threads.map((thread) => [thread.id, thread.isResolved]));
    expect(byId.get('a')).toBe(false);
    expect(byId.get('b')).toBe(true);
    expect(byId.get('c')).toBeNull();
  });

  it('anchors a diff thread to its file and line and orders threads oldest first', () => {
    const conversation = gitlabMrConversation({
      discussions: [
        discussion({ id: 'late', notes: [note({ id: 1, createdAt: '2026-07-23T10:00:00Z' })] }),
        discussion({
          id: 'early',
          notes: [
            note({
              id: 2,
              createdAt: '2026-07-21T10:00:00Z',
              position: { newPath: 'settle/batch.ts', oldPath: null, newLine: 48, oldLine: null },
            }),
          ],
        }),
      ],
    });

    expect(conversation.threads.map((thread) => thread.id)).toEqual(['early', 'late']);
    expect(conversation.threads[0]?.anchor).toBe('settle/batch.ts:48');
    expect(conversation.threads[1]?.anchor).toBeNull();
  });
});
