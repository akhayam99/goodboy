import type { AgentId, MountId, SessionId } from '@goodboy/types';
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

export type ReplyFromCommentRunParams = CommentRunThreadParams & {
  readonly mountId: MountId | null;
  readonly reply: string;
};

export type SendChangeToCommentRunParams = AddToCommentRunParams;

export type CommentRunStartSlice = CommentRunStartState & {
  addToCommentRun(params: AddToCommentRunParams): Promise<void>;
  replyFromCommentRun(params: ReplyFromCommentRunParams): Promise<void>;
  sendChangeToCommentRun(params: SendChangeToCommentRunParams): Promise<void>;
  openCommentRunStart(params: CommentRunThreadParams): void;
  closeCommentRunStart(params: CloseCommentRunStartParams): void;
  keepCommentRunGoal(params: CloseCommentRunStartParams): void;
  setCommentRunExtras(params: SetCommentRunExtrasParams): void;
  finishCommentRunStart(params: CommentRunThreadParams): void;
};
