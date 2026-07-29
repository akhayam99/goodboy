import { listPendingResolutionsForSession, queuePendingResolution } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolverOutcomeForThread } from './resolverOutcomeForThread';
import type { GetFn, SetFn } from './types';

type QueueArgs = { threadId: string; commitSha: string; prNumber: number };

export const queueResolution = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    { threadId, commitSha, prNumber }: QueueArgs,
  ): Promise<void> => {
    const outcome = resolverOutcomeForThread({
      outcomes: get().resolverThreadOutcomes,
      threadId,
    });
    await queuePendingResolution({
      db: tauriDatabase,
      id: crypto.randomUUID(),
      sessionId,
      prNumber,
      threadId,
      commitSha,
      reply: outcome?.reply ?? null,
      outcome: outcome?.kind ?? null,
    });
    const rows = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
    set((state) => ({
      sessionPendingResolutions: { ...state.sessionPendingResolutions, [sessionId]: rows },
    }));
  };
};
