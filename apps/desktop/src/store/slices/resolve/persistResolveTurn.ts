import {
  listOpenQuestionsForSession,
  insertResolveAttempt,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
  insertResolveQueueItem,
  rebaseResolveQueueItem,
  setResolveAttemptPhase,
} from '@goodboy/db';
import { saveResolveThread } from './saveResolveThread';
import { formatError } from '@goodboy/ui';
import type { ResolveAttempt, ResolveThread, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { agentLastMessage } from '../../../features/resolve/agentLastMessage';
import { agentThreadIds } from '../../../features/session/agentThreadIds';
import { resolverTurnOutcomes } from '../../../features/session/resolverTurnOutcomes';
import { captureResolveCandidate } from './captureResolveCandidate';
import { createResolveThread } from './createResolveThread';
import { outcomePatch } from './outcomePatch';
import { projectResolveRows } from './projectResolveRows';
import { threadOutcome } from './threadOutcome';
import type { SliceParams, TurnParams } from './types';
import { activeReviewSourceOf } from '../review-source/activeReviewSource';

type Params = SliceParams & TurnParams;

const isRecoverableCause = ({ attempt }: { readonly attempt: ResolveAttempt }): boolean =>
  attempt.failureCause === 'app_closed' ||
  attempt.failureCause === 'provider_error' ||
  (attempt.failureCause == null && attempt.error === 'interrupted');

const failUncaptured = async ({
  sessionId,
  attemptId,
  error,
}: {
  readonly sessionId: SessionId;
  readonly attemptId: string;
  readonly error: unknown;
}): Promise<void> => {
  const db = tauriDatabase;
  const rows = await listResolveThreads({ db, sessionId });
  for (const row of rows) {
    if (row.activeAttemptId !== attemptId || row.disposition !== 'fix' || row.state !== 'fixed') {
      continue;
    }
    await saveResolveThread({
      db,
      row: { ...row, state: 'failed', updatedAt: Date.now() },
      expectedRevision: row.revision,
    });
  }
  await setResolveAttemptPhase({
    db,
    id: attemptId,
    phase: 'failed',
    error: formatError(error),
    failureCause: 'capture_failed',
  });
};

export const persistResolveTurn = async ({
  set,
  get,
  sessionId,
  agent,
  assistantText,
  isCandidate = false,
  attemptId,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const rows = await listResolveThreads({ db, sessionId });
  const previousOutcomes = Object.fromEntries(
    rows.flatMap((row) => {
      const outcome = threadOutcome({ row, shouldIncludeCandidate: true });
      return outcome === null ? [] : [[row.threadId, outcome]];
    }),
  );
  const parsed = resolverTurnOutcomes({ assistantText, previousOutcomes });
  const sourceThreadIds = agentThreadIds(agent);
  const owned = sourceThreadIds.length > 0 ? sourceThreadIds : Object.keys(parsed.turnOutcomes);
  if (owned.length === 0) {
    return;
  }
  const hasOwnedMarkers = owned.some(
    (threadId) =>
      parsed.turnOutcomes[threadId] !== undefined || parsed.questions[threadId] !== undefined,
  );
  if (isCandidate && !hasOwnedMarkers) {
    return;
  }
  const attempts = await listResolveAttempts({ db, sessionId });
  const attempt = [...attempts].reverse().find((item) => item.agentId === agent.id);
  const isRecoverable =
    !isCandidate &&
    hasOwnedMarkers &&
    attempt?.phase === 'failed' &&
    isRecoverableCause({ attempt });
  if (
    attemptId !== undefined &&
    (attempt?.id !== attemptId ||
      attempt.phase === 'cancelled' ||
      (attempt.phase === 'failed' && !isRecoverable) ||
      (isCandidate && attempt.phase !== 'running'))
  ) {
    return;
  }
  if (sourceThreadIds.length === 0 && attempt !== undefined) {
    await insertResolveAttempt({ db, attempt: { ...attempt, threadIds: owned } });
  }
  const questions = isCandidate ? [] : await listOpenQuestionsForSession(db, sessionId);
  const hasAsked = Object.keys(parsed.questions).length > 0;
  const question = hasAsked
    ? null
    : (questions.find((item) => item.createdByAgentId === agent.id && item.status === 'open')
        ?.text ?? null);
  const lastMessage = agentLastMessage({ assistantText });
  let hasSilentThread = false;
  const processed: Array<string> = [];
  for (const threadId of owned) {
    const previous = rows.find((row) => row.threadId === threadId);
    if (
      previous?.state === 'closed' ||
      (attemptId !== undefined && previous !== undefined && previous.activeAttemptId !== attemptId)
    ) {
      continue;
    }
    const outcome = parsed.turnOutcomes[threadId];
    const asked = parsed.questions[threadId];
    processed.push(threadId);
    if (isCandidate && outcome === undefined) {
      continue;
    }
    const row =
      previous ??
      createResolveThread({
        sessionId,
        threadId,
        agent,
        projectId: get().sessionActiveProject[sessionId] ?? null,
        prNumber: activeReviewSourceOf({ state: get(), sessionId })?.prNumber,
      });
    const retained = threadOutcome({ row });
    const verdict =
      parsed.analysisVerdicts[threadId] ??
      (row.disposition === 'no_change' ? 'wontfix' : undefined);
    const askedText = question ?? (lastMessage === '' ? null : lastMessage);
    const kept = retained !== null && (hasOwnedMarkers || question !== null) ? retained : null;
    const asking = retained === null ? { stateReason: 'question' } : {};
    const patch: Partial<ResolveThread> = (() => {
      if (asked !== undefined) {
        return { state: 'needs_answer', question: asked.question, ...asking };
      }
      if (outcome !== undefined) {
        return outcomePatch({ outcome, verdict, previous });
      }
      if (kept !== null) {
        return outcomePatch({ outcome: kept, verdict, previous });
      }
      if (askedText === null) {
        return { state: 'failed' };
      }
      return { state: 'needs_answer', question: askedText, ...asking };
    })();
    hasSilentThread =
      hasSilentThread ||
      (!isCandidate &&
        asked === undefined &&
        outcome === undefined &&
        kept === null &&
        askedText === null);
    const next = {
      ...row,
      ...patch,
      activeAttemptId: attempt?.id ?? row.activeAttemptId,
      updatedAt: Date.now(),
    };
    if (isCandidate) {
      next.state = 'working';
      next.stateReason = `candidate:${patch.stateReason ?? patch.state ?? ''}`;
    }
    await saveResolveThread({ db, row: next, expectedRevision: previous?.revision ?? null });
  }
  if (!isCandidate && attempt !== undefined) {
    const waiting = (await listResolveThreads({ db, sessionId })).some(
      (row) => processed.includes(row.threadId) && row.state === 'needs_answer',
    );
    await setResolveAttemptPhase(
      hasSilentThread
        ? {
            db,
            id: attempt.id,
            phase: 'failed',
            error: 'the provider returned no message',
            failureCause: 'provider_error',
          }
        : { db, id: attempt.id, phase: waiting ? 'waiting' : 'finished' },
    );
  }
  if (!isCandidate) {
    const updatedRows = await listResolveThreads({ db, sessionId });
    const queueItems = await listResolveQueueItems({ db, sessionId });
    for (const row of updatedRows) {
      if (!processed.includes(row.threadId) || row.disposition === null) {
        continue;
      }
      const queued = queueItems.find(({ thread }) => thread.threadId === row.threadId);
      if (queued !== undefined) {
        if (queued.item.candidateRevision !== row.revision) {
          await rebaseResolveQueueItem({
            db,
            sessionId,
            itemId: queued.item.id,
            candidateRevision: row.revision,
          });
        }
        continue;
      }
      const now = Date.now();
      await insertResolveQueueItem({
        db,
        item: {
          id: crypto.randomUUID(),
          sessionId,
          threadId: row.threadId,
          generation: 0,
          reopenedFromItemId: null,
          candidateRevision: row.revision,
          approvalState: 'none',
          approvedRevision: null,
          approvedReplyHash: null,
          integratedSha: null,
          deferredAt: null,
          deliveredAt: null,
          supersededAt: null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    if (attempt !== undefined) {
      try {
        await captureResolveCandidate({
          set,
          get,
          sessionId,
          attemptId: attempt.id,
          threadIds: processed,
        });
      } catch (error) {
        await failUncaptured({ sessionId, attemptId: attempt.id, error });
      }
    }
    const capturedRows = await listResolveThreads({ db, sessionId });
    projectResolveRows({
      set,
      get,
      sessionId,
      rows: capturedRows,
      attempts: await listResolveAttempts({ db, sessionId }),
    });
    const refreshedQueueItems = await listResolveQueueItems({ db, sessionId });
    set((state) => ({
      sessionResolveQueueItems: {
        ...state.sessionResolveQueueItems,
        [sessionId]: refreshedQueueItems,
      },
    }));
  }
};
