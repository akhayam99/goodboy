import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { SliceDeps } from '../../slice-types';
import { addToCommentRun } from './addToCommentRun';
import { replyFromCommentRun } from './replyFromCommentRun';
import { sendChangeToCommentRun } from './sendChangeToCommentRun';
import { commentRunStartInitialState, type CommentRunDraft, type CommentRunStart } from './state';
import type {
  CloseCommentRunStartParams,
  CommentRunStartSlice,
  CommentRunThreadParams,
  SetCommentRunExtrasParams,
} from './types';

const EMPTY_START: CommentRunStart = { openThreadId: null, drafts: {} };

const EMPTY_DRAFT: CommentRunDraft = { goal: null, extraThreadIds: [] };

type PatchArgs = {
  readonly start: CommentRunStart;
};

type PatchParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly patch: (params: PatchArgs) => CommentRunStart;
};

const patched = ({ state, sessionId, patch }: PatchParams): Partial<AppStore> => ({
  commentRunStarts: {
    ...state.commentRunStarts,
    [sessionId]: patch({ start: state.commentRunStarts[sessionId] ?? EMPTY_START }),
  },
});

type DraftParams = {
  readonly start: CommentRunStart;
  readonly threadId: string;
  readonly draft: Partial<CommentRunDraft>;
};

const withDraft = ({ start, threadId, draft }: DraftParams): CommentRunStart['drafts'] => ({
  ...start.drafts,
  [threadId]: { ...(start.drafts[threadId] ?? EMPTY_DRAFT), ...draft },
});

export const createCommentRunStartSlice = ({ set, get }: SliceDeps): CommentRunStartSlice => ({
  ...commentRunStartInitialState,
  addToCommentRun: addToCommentRun({ set, get }),
  replyFromCommentRun: replyFromCommentRun({ get }),
  sendChangeToCommentRun: sendChangeToCommentRun({ set, get }),
  openCommentRunStart: ({ sessionId, threadId }: CommentRunThreadParams) =>
    set((state) =>
      patched({ state, sessionId, patch: ({ start }) => ({ ...start, openThreadId: threadId }) }),
    ),
  closeCommentRunStart: ({ sessionId, threadId, goal }: CloseCommentRunStartParams) =>
    set((state) =>
      patched({
        state,
        sessionId,
        patch: ({ start }) => ({
          openThreadId: start.openThreadId === threadId ? null : start.openThreadId,
          drafts: withDraft({ start, threadId, draft: { goal } }),
        }),
      }),
    ),
  keepCommentRunGoal: ({ sessionId, threadId, goal }: CloseCommentRunStartParams) =>
    set((state) => {
      if (state.commentRunStarts[sessionId]?.openThreadId !== threadId) {
        return {};
      }
      return patched({
        state,
        sessionId,
        patch: ({ start }) => ({
          ...start,
          drafts: withDraft({ start, threadId, draft: { goal } }),
        }),
      });
    }),
  setCommentRunExtras: ({ sessionId, threadId, extraThreadIds }: SetCommentRunExtrasParams) =>
    set((state) =>
      patched({
        state,
        sessionId,
        patch: ({ start }) => ({
          ...start,
          drafts: withDraft({
            start,
            threadId,
            draft: { extraThreadIds: [...new Set(extraThreadIds)] },
          }),
        }),
      }),
    ),
  finishCommentRunStart: ({ sessionId, threadId }: CommentRunThreadParams) =>
    set((state) =>
      patched({
        state,
        sessionId,
        patch: ({ start }) => ({
          openThreadId: start.openThreadId === threadId ? null : start.openThreadId,
          drafts: Object.fromEntries(
            Object.entries(start.drafts).filter(([id]) => id !== threadId),
          ),
        }),
      }),
    ),
});
