import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { postReplyWhenNothingWaits } from '../../resolve/replyDelivery';
import { launchRowsOf } from '../../resolve/reviewRows';
import { hostThreadIdOf } from './threadIds';

const NOT_IN_COMMENTS = 'This comment is no longer in Comments';

type Params = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly id: string;
};

const rowOf = ({ getState, sessionId, id }: Params) => {
  const threadId = hostThreadIdOf({ id });
  const row = launchRowsOf({ state: getState(), sessionId }).find(
    (candidate) => candidate.thread.threadId === threadId,
  );
  if (row === undefined) {
    throw new Error(NOT_IN_COMMENTS);
  }
  return { row, threadId };
};

export const replyOnHostThread = async ({
  body,
  ...params
}: Params & { readonly body: string }): Promise<void> => {
  const { row, threadId } = rowOf(params);
  await params.getState().refuseResolveQueueItem({
    sessionId: params.sessionId,
    itemId: row.item.id,
    revision: row.thread.revision,
    reply: body,
  });
  await postReplyWhenNothingWaits({
    getState: params.getState,
    sessionId: params.sessionId,
    threadId,
  });
};

export const resolveHostThread = async (params: Params): Promise<void> => {
  const { row, threadId } = rowOf(params);
  await params.getState().resolveWithoutReply({ sessionId: params.sessionId, itemId: row.item.id });
  await postReplyWhenNothingWaits({
    getState: params.getState,
    sessionId: params.sessionId,
    threadId,
  });
};
