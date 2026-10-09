import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly itemId: string;
  readonly revision: number;
  readonly reply: string;
};

export const acceptReviewItem = async ({
  state,
  sessionId,
  itemId,
  revision,
  reply,
}: Params): Promise<void> => {
  await state.acceptResolveQueueItem({ sessionId, itemId, revision, reply });
};
