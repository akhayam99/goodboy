import type {
  ConversationCapabilities,
  ConversationMessage,
  ConversationThread,
} from '../../../shared/components/Conversation/types';
import type { GitlabMrDiscussion, GitlabMrNote } from './client';

export const GITLAB_MR_CAPABILITIES = {
  reply: 'thread',
  startThread: true,
  resolve: true,
  react: false,
} satisfies ConversationCapabilities;

type NoteParams = {
  readonly note: GitlabMrNote;
};

const anchorOf = ({ note }: NoteParams): string | null => {
  const position = note.position;
  if (position == null) {
    return null;
  }
  const path = position.newPath ?? position.oldPath;
  if (path == null || path === '') {
    return null;
  }
  const line = position.newLine ?? position.oldLine;
  return line == null ? path : `${path}:${line}`;
};

const messageOf = ({ note }: NoteParams): ConversationMessage => ({
  id: String(note.id),
  author: {
    name: note.author?.name ?? 'Unknown',
    avatarUrl: note.author?.avatarUrl ?? null,
    handle: null,
  },
  createdAt: note.createdAt,
  body: note.body,
  status: 'sent',
});

type Params = {
  readonly discussions: ReadonlyArray<GitlabMrDiscussion>;
};

type Result = {
  readonly threads: ReadonlyArray<ConversationThread>;
  readonly systemNoteCount: number;
};

export const gitlabMrConversation = ({ discussions }: Params): Result => {
  const threads: ConversationThread[] = [];
  let systemNoteCount = 0;

  for (const discussion of discussions) {
    const notes = discussion.notes.filter((note) => !note.system);
    systemNoteCount += discussion.notes.length - notes.length;
    const [head, ...replies] = notes;
    if (head === undefined) {
      continue;
    }
    const resolvable = notes.filter((note) => note.resolvable);
    threads.push({
      id: discussion.id,
      head: messageOf({ note: head }),
      replies: replies.map((note) => messageOf({ note })),
      anchor: anchorOf({ note: head }),
      isResolved:
        resolvable.length === 0 ? null : resolvable.every((note) => note.resolved === true),
    });
  }

  return {
    threads: threads.sort((left, right) => left.head.createdAt.localeCompare(right.head.createdAt)),
    systemNoteCount,
  };
};
