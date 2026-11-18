import type { SessionId } from '@goodboy/types';

export type CommentRunDraft = {
  readonly goal: string | null;
  readonly extraThreadIds: ReadonlyArray<string>;
};

export type CommentRunStart = {
  readonly openThreadId: string | null;
  readonly drafts: Readonly<Record<string, CommentRunDraft>>;
};

export type CommentRunStartState = {
  readonly commentRunStarts: Readonly<Record<SessionId, CommentRunStart>>;
};

export const commentRunStartInitialState: CommentRunStartState = {
  commentRunStarts: {},
};
