import type { DiffComment } from '@goodboy/types';
import type { CommentThread } from '../../github/comment-threads';

const NOTE_PREFIX = 'note:';
const GENERATION_SUFFIX = /:g(\d+)$/;

export const NOTE_AUTHOR_YOU = 'You';
export const NOTE_AUTHOR_AGENT = 'Reviewer agent';

export const noteThreadId = ({
  noteId,
  generation = 0,
}: {
  readonly noteId: string;
  readonly generation?: number;
}): string =>
  generation === 0 ? `${NOTE_PREFIX}${noteId}` : `${NOTE_PREFIX}${noteId}:g${generation}`;

export const isNoteThreadId = ({ threadId }: { readonly threadId: string }): boolean =>
  threadId.startsWith(NOTE_PREFIX);

export const noteIdOfThread = ({ threadId }: { readonly threadId: string }): string | null =>
  isNoteThreadId({ threadId })
    ? threadId.slice(NOTE_PREFIX.length).replace(GENERATION_SUFFIX, '')
    : null;

export const isOpenNote = ({ note }: { readonly note: DiffComment }): boolean =>
  note.status === 'open' || note.status === 'consumed';

export const noteCommentThread = ({ note }: { readonly note: DiffComment }): CommentThread => ({
  head: {
    id: note.id,
    author: note.authorKind === 'agent' ? NOTE_AUTHOR_AGENT : NOTE_AUTHOR_YOU,
    authorAvatarUrl: null,
    body: note.body,
    createdAt: note.createdAt,
    url: '',
    source: 'review',
    path: note.filePath,
    ...(note.anchor !== undefined && { line: note.anchor.lineNumber }),
    resolved: !isOpenNote({ note }),
    threadId: noteThreadId({ noteId: note.id }),
    canResolve: false,
  },
  replies: [],
});

export const areNotesOnly = ({
  threads,
}: {
  readonly threads: ReadonlyArray<CommentThread>;
}): boolean =>
  threads.length > 0 &&
  threads.every((thread) => isNoteThreadId({ threadId: thread.head.threadId ?? '' }));
