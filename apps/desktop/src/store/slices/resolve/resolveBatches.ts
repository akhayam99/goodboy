import {
  getResolveParallelLimit,
  insertResolveBatch,
  listResolveBatches,
  setResolveParallelLimit as saveResolveParallelLimit,
} from '@goodboy/db';
import type { ResolveBatch } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type {
  CreateBatchParams,
  ParallelLimitParams,
  SessionParams,
  SetFn,
  SliceParams,
} from './types';

type LoadParams = { readonly set: SetFn } & SessionParams;

export const loadResolveBatchesInto = async ({ set, sessionId }: LoadParams): Promise<void> => {
  const db = tauriDatabase;
  const batches = await listResolveBatches({ db, sessionId });
  const limit = await getResolveParallelLimit({ db, sessionId });
  set((state) => ({
    sessionResolveBatches: { ...state.sessionResolveBatches, [sessionId]: batches },
    sessionResolveParallelLimit: { ...state.sessionResolveParallelLimit, [sessionId]: limit },
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

export const setResolveParallelLimit = async ({
  set,
  get,
  sessionId,
  limit,
}: SliceParams & ParallelLimitParams): Promise<void> => {
  await saveResolveParallelLimit({ db: tauriDatabase, sessionId, limit });
  await loadResolveBatchesInto({ set, sessionId });
  void get().drainResolveQueue({ sessionId });
};
