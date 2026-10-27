import { listResolveQueueItems } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { CurrentParams, SetFn } from './types';

type Params = { readonly set: SetFn; readonly sessionId: SessionId } & CurrentParams;

export const loadResolveQueueItemsInto = async ({
  set,
  sessionId,
  isCurrent = () => true,
}: Params): Promise<void> => {
  const items = await listResolveQueueItems({ db: tauriDatabase, sessionId });
  if (!isCurrent()) {
    return;
  }
  set((state) => ({
    sessionResolveQueueItems: { ...state.sessionResolveQueueItems, [sessionId]: items },
  }));
};
