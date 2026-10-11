import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { acceptReviewItem } from './acceptReviewItem';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly itemId: string;
  readonly revision: number;
  readonly reply: string;
  readonly isOnRemote: boolean;
};

export const postOutcomeReply = async ({
  state,
  sessionId,
  threadId,
  itemId,
  revision,
  reply,
  isOnRemote,
}: Params): Promise<void> => {
  if (isOnRemote) {
    await state.replyAndResolveThread({ sessionId, threadId, reply });
    return;
  }
  await acceptReviewItem({ state, sessionId, itemId, revision, reply });
  await state.publishThreadNow({ sessionId, threadId });
};
