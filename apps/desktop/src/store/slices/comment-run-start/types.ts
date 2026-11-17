import type { AgentId, SessionId } from '@goodboy/types';
import type { CommentRunStartState } from './state';

export type CommentRunThreadParams = {
  readonly sessionId: SessionId;
  readonly threadId: string;
};

export type CloseCommentRunStartParams = CommentRunThreadParams & {
  readonly goal: string | null;
};

export type SetCommentRunExtrasParams = CommentRunThreadParams & {
  readonly extraThreadIds: ReadonlyArray<string>;
};

export type AddToCommentRunParams = CommentRunThreadParams & {
  readonly agentId: AgentId;
  readonly quote: string;
};

export type CommentRunStartSlice = CommentRunStartState & {
  addToCommentRun(params: AddToCommentRunParams): Promise<void>;
  openCommentRunStart(params: CommentRunThreadParams): void;
  closeCommentRunStart(params: CloseCommentRunStartParams): void;
  keepCommentRunGoal(params: CloseCommentRunStartParams): void;
  setCommentRunExtras(params: SetCommentRunExtrasParams): void;
  finishCommentRunStart(params: CommentRunThreadParams): void;
};
