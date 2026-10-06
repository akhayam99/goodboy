import { listResolveAttempts, listResolveThreads, setResolveAttemptPhase } from '@goodboy/db';
import { saveResolveThread } from './saveResolveThread';
import type { ResolveFailureCause, ResolveThread } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import { createResolveThread } from './createResolveThread';
import { outcomePatch } from './outcomePatch';
import { projectResolveRows } from './projectResolveRows';
import { threadOutcome } from './threadOutcome';
import type { PhaseParams, SliceParams } from './types';
import { activeReviewSourceOf } from '../review-source/activeReviewSource';

type Params = SliceParams & PhaseParams;

const causeOf = ({
  phase,
  failureCause,
}: Pick<PhaseParams, 'phase' | 'failureCause'>): ResolveFailureCause | null => {
  if (phase === 'cancelled') {
    return 'stopped';
  }
  return phase === 'failed' ? (failureCause ?? null) : null;
};

export const recordResolvePhase = async ({
  set,
  get,
  sessionId,
  agentId,
  attemptId,
  phase,
  error = null,
  failureCause,
  isCleanExit = false,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const attempts = await listResolveAttempts({ db, sessionId });
  const attempt = [...attempts].reverse().find((item) => item.agentId === agentId);
  if (attemptId !== undefined && attempt?.id !== attemptId) {
    return;
  }
  if (attempt !== undefined) {
    await setResolveAttemptPhase({
      db,
      id: attempt.id,
      phase,
      error,
      failureCause: causeOf({ phase, failureCause }),
    });
  }
  if (phase === 'failed' || phase === 'cancelled') {
    const rows = await listResolveThreads({ db, sessionId });
    const agent = get().sessionPhaseRuns[sessionId]?.find((item) => item.id === agentId);
    const owned = attempt?.threadIds ?? (agent === undefined ? [] : agentThreadIds(agent));
    for (const threadId of owned) {
      const previous = rows.find((row) => row.threadId === threadId);
      const row =
        previous ??
        createResolveThread({
          sessionId,
          threadId,
          agent,
          prNumber: activeReviewSourceOf({ state: get(), sessionId })?.prNumber,
        });
      if ((attempt !== undefined && row.activeAttemptId !== attempt.id) || row.state === 'closed') {
        continue;
      }
      const candidate =
        phase === 'failed' && isCleanExit && threadOutcome({ row }) === null
          ? threadOutcome({ row, shouldIncludeCandidate: true })
          : null;
      const patch: Partial<ResolveThread> =
        candidate === null ? { state: 'failed' } : outcomePatch({ outcome: candidate });
      await saveResolveThread({
        db,
        row: { ...row, ...patch, updatedAt: Date.now() },
        expectedRevision: previous?.revision ?? null,
      });
    }
  }
  projectResolveRows({
    set,
    get,
    sessionId,
    rows: await listResolveThreads({ db, sessionId }),
    attempts: await listResolveAttempts({ db, sessionId }),
  });
};
