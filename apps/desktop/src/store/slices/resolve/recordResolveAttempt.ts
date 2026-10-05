import { insertResolveAttempt, listResolveAttempts, listResolveThreads } from '@goodboy/db';
import { saveResolveThread } from './saveResolveThread';
import { formatError } from '@goodboy/ui';
import type { ResolveAttempt } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import { worktreeStatus } from '../../../features/worktree/worktree';
import { beginResolveCandidate } from './beginResolveCandidate';
import { createResolveThread } from './createResolveThread';
import { ResolveFailure } from './resolveFailure';
import { withoutLegacyFailurePrefix } from './resolveOutcomeReason';
import { threadOutcome } from './threadOutcome';
import { projectResolveRows } from './projectResolveRows';
import type { AttemptParams, SliceParams } from './types';
import { activeReviewSourceOf } from '../review-source/activeReviewSource';

type Params = SliceParams & AttemptParams;

export const recordResolveAttempt = async ({
  set,
  get,
  sessionId,
  agent,
  provider,
  model,
  effort,
  instructions,
  humanInstructions,
  phase,
  threadIds,
  mountTarget,
  candidateMode = 'propose',
  batch,
  launch,
  copyPath,
}: Params): Promise<string> => {
  const db = tauriDatabase;
  const attempts = await listResolveAttempts({ db, sessionId });
  const ofAgent = attempts.filter((attempt) => attempt.agentId === agent.id);
  const queued = ofAgent.find(
    (attempt) => attempt.phase === 'queued' || attempt.phase === 'running',
  );
  const previous = ofAgent.at(-1);
  const now = Date.now();
  const attempt: ResolveAttempt = {
    id: queued?.id ?? crypto.randomUUID(),
    sessionId,
    agentId: agent.id,
    prNumber: createResolveThread({
      sessionId,
      threadId: '',
      agent,
      prNumber: activeReviewSourceOf({ state: get(), sessionId })?.prNumber,
    }).prNumber,
    threadIds: threadIds ?? agentThreadIds(agent),
    provider,
    model,
    effort,
    instructions,
    humanInstructions: humanInstructions ?? queued?.humanInstructions ?? null,
    phase,
    mountTarget,
    startedAt: phase === 'running' ? now : null,
    endedAt: null,
    error: null,
    createdAt: queued?.createdAt ?? now,
    batchId: batch?.batchId ?? queued?.batchId ?? previous?.batchId ?? null,
    launchId: launch?.launchId ?? queued?.launchId ?? previous?.launchId ?? null,
    retryOfLaunchId: queued?.retryOfLaunchId ?? previous?.retryOfLaunchId ?? null,
    copyPath: copyPath ?? queued?.copyPath ?? null,
    launchChoice: batch?.launchChoice ?? queued?.launchChoice ?? previous?.launchChoice ?? null,
  };
  await insertResolveAttempt({ db, attempt });
  if (phase === 'running' && candidateMode === 'propose') {
    try {
      const baseSha =
        attempt.copyPath === null
          ? undefined
          : ((await worktreeStatus({ worktreePath: attempt.copyPath }).catch(() => null))?.head ??
            undefined);
      await beginResolveCandidate({
        set,
        get,
        sessionId,
        attemptId: attempt.id,
        mountTarget,
        ...(baseSha !== undefined && { baseSha }),
      });
    } catch (error) {
      throw new ResolveFailure({ failureCause: 'capture_failed', message: formatError(error) });
    }
  }
  const rows = await listResolveThreads({ db, sessionId });
  for (const threadId of attempt.threadIds) {
    const previous = rows.find((row) => row.threadId === threadId);
    if (previous?.state === 'closed') {
      continue;
    }
    const row =
      previous ??
      createResolveThread({
        sessionId,
        threadId,
        agent,
        projectId: get().sessionActiveProject[sessionId] ?? null,
        prNumber: attempt.prNumber,
      });
    await saveResolveThread({
      db,
      row: {
        ...row,
        state: 'working',
        stateReason:
          threadOutcome({ row }) === null
            ? null
            : withoutLegacyFailurePrefix({ stateReason: row.stateReason }),
        question: null,
        activeAttemptId: attempt.id,
        updatedAt: now,
      },
      expectedRevision: previous?.revision ?? null,
    });
  }
  projectResolveRows({
    set,
    get,
    sessionId,
    rows: await listResolveThreads({ db, sessionId }),
    attempts: await listResolveAttempts({ db, sessionId }),
  });
  return attempt.id;
};
