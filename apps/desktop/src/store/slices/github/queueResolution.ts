import { listPendingResolutionsForSession, queuePendingResolution } from '@goodboy/db';
import type { PendingResolutionOutcome, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolverOutcomeForThread } from './resolverOutcomeForThread';
import type { GetFn, SetFn } from './types';

type QueueArgs = {
  readonly threadId: string;
  readonly commitSha: string;
  readonly prNumber: number;
  readonly reply?: string | null;
  readonly outcome?: PendingResolutionOutcome | null;
};

export const queueResolution = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    { threadId, commitSha, prNumber, reply, outcome: explicitOutcome }: QueueArgs,
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
      reply: reply === undefined ? (outcome?.reply ?? null) : reply,
      outcome: explicitOutcome ?? outcome?.kind ?? null,
    });
    const rows = await listPendingResolutionsForSession({ db: tauriDatabase, sessionId });
    set((state) => ({
      sessionPendingResolutions: { ...state.sessionPendingResolutions, [sessionId]: rows },
    }));
  };
};
