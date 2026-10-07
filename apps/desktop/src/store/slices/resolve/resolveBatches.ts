import { insertResolveBatch, listResolveBatches } from '@goodboy/db';
import type { ResolveBatch } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { CreateBatchParams, SessionParams, SetFn, SliceParams } from './types';

type LoadParams = { readonly set: SetFn } & SessionParams;

export const loadResolveBatchesInto = async ({ set, sessionId }: LoadParams): Promise<void> => {
  const batches = await listResolveBatches({ db: tauriDatabase, sessionId });
  set((state) => ({
    sessionResolveBatches: { ...state.sessionResolveBatches, [sessionId]: batches },
  }));
};

export const createResolveBatch = async ({
  set,
  sessionId,
  threadIds,
  launchChoice,
}: SliceParams & CreateBatchParams): Promise<ResolveBatch> => {
  const batch: ResolveBatch = {
    id: crypto.randomUUID(),
    sessionId,
    threadIds: [...new Set(threadIds)],
    launchChoice,
    createdAt: Date.now(),
  };
  await insertResolveBatch({ db: tauriDatabase, batch });
  await loadResolveBatchesInto({ set, sessionId });
  return batch;
};
