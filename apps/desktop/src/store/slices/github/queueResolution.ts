import { listPendingResolutionsForSession, queuePendingResolution } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type QueueArgs = { threadId: string; commitSha: string; prNumber: number };

/**
 * Mark a review thread "solved locally, push later". The resolver agent has
 * already committed; this only records the intent so `pushAllResolutions` can
 * publish a batch with a single push. No git or GitHub call here.
 */
export function queueResolution(set: SetFn, _get: GetFn) {
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
}
