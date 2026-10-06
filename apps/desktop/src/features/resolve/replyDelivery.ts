import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { activeReviewSourceOf } from '../../store/slices/review-source/activeReviewSource';
import { remoteOf } from './reviewRemote';
import { launchRowsOf, rowStateOf } from './reviewRows';

type SessionParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

export const isPushWaiting = ({ state, sessionId }: SessionParams): boolean =>
  launchRowsOf({ state, sessionId }).some((row) => {
    const rowState = rowStateOf({ state, sessionId, row });
    return (
      rowState === 'accepted' &&
      remoteOf({
        state: rowState,
        facts: state.sessionThreadGit?.[sessionId]?.[row.thread.threadId] ?? null,
      }) !== 'on_origin'
    );
  });

export const isReplyOnlyAwaiting = ({
  state,
  sessionId,
  threadId,
}: SessionParams & { readonly threadId: string }): boolean => {
  const row = launchRowsOf({ state, sessionId }).find(
    (candidate) => candidate.thread.threadId === threadId,
  );
  return (
    row !== undefined &&
    row.thread.originKind !== 'diff_comment' &&
    rowStateOf({ state, sessionId, row }) === 'replied' &&
    activeReviewSourceOf({ state, sessionId }) !== null
  );
};

type PostParams = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadId: string;
};

export const postReplyNow = ({ getState, sessionId, threadId }: PostParams): Promise<void> =>
  getState().publishThreadNow({ sessionId, threadId });

export const postReplyWhenNothingWaits = async ({
  getState,
  sessionId,
  threadId,
}: PostParams): Promise<boolean> => {
  const state = getState();
  if (!isReplyOnlyAwaiting({ state, sessionId, threadId }) || isPushWaiting({ state, sessionId })) {
    return false;
  }
  await postReplyNow({ getState, sessionId, threadId });
  return true;
};
