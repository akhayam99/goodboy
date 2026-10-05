import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly itemId: string;
  readonly revision: number;
  readonly reply: string;
  readonly isNote: boolean;
  readonly hasPr: boolean;
};

export const acceptReviewItem = async ({
  state,
  sessionId,
  threadId,
  itemId,
  revision,
  reply,
  isNote,
  hasPr,
}: Params): Promise<void> => {
  await state.acceptResolveQueueItem({ sessionId, itemId, revision, reply });
  if (isNote && !hasPr) {
    await state.closeResolvedNote({ sessionId, threadId });
  }
};
