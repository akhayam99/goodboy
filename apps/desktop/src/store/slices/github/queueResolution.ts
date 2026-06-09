import { listPendingResolutionsForSession, queuePendingResolution } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type QueueArgs = { threadId: string; commitSha: string; prNumber: number };

export const queueResolution = (set: SetFn, _get: GetFn) => {
  return async (
    sessionId: SessionId,
    { threadId, commitSha, prNumber }: QueueArgs,
  ): Promise<void> => {
    await queuePendingResolution(
      tauriDatabase,
      crypto.randomUUID(),
      sessionId,
      prNumber,
      threadId,
      commitSha,
    );
    const rows = await listPendingResolutionsForSession(tauriDatabase, sessionId);
    set((state) => ({
      sessionPendingResolutions: { ...state.sessionPendingResolutions, [sessionId]: rows },
    }));
  };
};
