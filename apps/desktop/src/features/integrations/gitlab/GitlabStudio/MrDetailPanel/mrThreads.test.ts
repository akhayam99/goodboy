import { describe, expect, it } from 'vitest';
import type { GitlabMrDiscussion, GitlabMrNote } from '../../client';
import { buildMrConversation, threadAnchor } from './mrThreads';

type NoteParams = Partial<GitlabMrNote> & { readonly id: number };

type DiscussionParams = {
  readonly id: string;
  readonly notes: ReadonlyArray<GitlabMrNote>;
};

const note = ({ id, ...rest }: NoteParams): GitlabMrNote => ({
  id,
  body: `note ${id}`,
  system: false,
  author: { username: 'alice', name: 'Alice', avatarUrl: null },
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

describe('buildMrConversation', () => {
  it('drops system notes and counts them', () => {
    const conversation = buildMrConversation({
      discussions: [
        discussion({
          id: 'a',
          notes: [
            note({ id: 1, body: 'tighten this' }),
            note({ id: 2, body: 'changed title from x to y', system: true }),
            note({ id: 3, body: 'done' }),
          ],
        }),
      ],
    });

    expect(conversation.systemNoteCount).toBe(1);
    expect(conversation.threads[0]?.head.body).toBe('tighten this');
    expect(conversation.threads[0]?.replies.map((reply) => reply.body)).toEqual(['done']);
  });

  it('drops a discussion made only of system notes', () => {
    const conversation = buildMrConversation({
      discussions: [
        discussion({ id: 'a', notes: [note({ id: 1, body: 'assigned to bob', system: true })] }),
        discussion({ id: 'b', notes: [note({ id: 2, body: 'real comment' })] }),
      ],
    });

    expect(conversation.threads).toHaveLength(1);
    expect(conversation.threads[0]?.id).toBe('b');
    expect(conversation.systemNoteCount).toBe(1);
  });

  it('marks a thread resolved only when every resolvable note is resolved', () => {
    const conversation = buildMrConversation({
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
    expect(byId.get('c')).toBe(false);
  });

  it('anchors an inline thread on its file and line', () => {
    const conversation = buildMrConversation({
      discussions: [
        discussion({
          id: 'a',
          notes: [
            note({
              id: 1,
              position: { newPath: 'src/a.ts', oldPath: null, newLine: 12, oldLine: null },
            }),
          ],
        }),
      ],
    });

    const thread = conversation.threads[0]!;
    expect(thread.filePath).toBe('src/a.ts');
    expect(threadAnchor({ thread })).toBe('src/a.ts:12');
  });

  it('sorts the newest thread first', () => {
    const conversation = buildMrConversation({
      discussions: [
        discussion({ id: 'old', notes: [note({ id: 1, createdAt: '2026-07-20T10:00:00Z' })] }),
        discussion({ id: 'new', notes: [note({ id: 2, createdAt: '2026-07-24T10:00:00Z' })] }),
      ],
    });

    expect(conversation.threads.map((thread) => thread.id)).toEqual(['new', 'old']);
  });
});
