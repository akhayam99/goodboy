import type { DiffComment, PrComment } from '@goodboy/types';
import { noteCommentThread, noteIdOfThread } from './notes/noteThread';

export type CommentRunHead = {
  readonly threadId: string;
  readonly isNote: boolean;
  readonly head: PrComment | null;
};

type Params = {
  readonly threadIds: ReadonlyArray<string>;
  readonly notes: ReadonlyArray<DiffComment>;
  readonly comments: ReadonlyArray<PrComment>;
};

type HeadParams = Omit<Params, 'threadIds'> & {
  readonly threadId: string;
};

const commentHeadOf = ({ threadId, notes, comments }: HeadParams): CommentRunHead => {
  const noteId = noteIdOfThread({ threadId });
  if (noteId !== null) {
    const note = notes.find((candidate) => candidate.id === noteId);
    return {
      threadId,
      isNote: true,
      head: note === undefined ? null : noteCommentThread({ note }).head,
    };
  }
  const head = comments.find(
    (comment) => comment.threadId === threadId && comment.inReplyToId == null,
  );
  return { threadId, isNote: false, head: head ?? null };
};

export const commentRunHeadsOf = ({
  threadIds,
  notes,
  comments,
}: Params): ReadonlyArray<CommentRunHead> =>
  [...new Set(threadIds)].map((threadId) => commentHeadOf({ threadId, notes, comments }));
