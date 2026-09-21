import type { IsoDateTime, OpenQuestionId, SessionId } from '@goodboy/types';
import { markOpenQuestionDismissed } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { liveQuestionDelegate } from '../../../features/context/questionDelegate';
import type { GetFn, SetFn } from './types';

export type CancelQuestionDelegatesParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly questionIds: ReadonlyArray<OpenQuestionId>;
};

export const cancelQuestionDelegates = async ({
  set,
  get,
  sessionId,
  questionIds,
}: CancelQuestionDelegatesParams): Promise<void> => {
  let cancelled = false;
  let dismissed = false;

  for (const questionId of questionIds) {
    const agents = get().sessionPhaseRuns[sessionId] ?? [];
    const delegate = liveQuestionDelegate({ agents, questionId });
    if (delegate === null) {
      continue;
    }
    cancelled = true;
    await get().cancelCurrentTurn(sessionId, delegate.id);
    await invokeAgentUpdateStatus(delegate.id, {
      status: 'skipped',
      completedAt: new Date().toISOString() as IsoDateTime,
    });
    const ownQuestions = (get().sessionOpenQuestions[sessionId] ?? []).filter(
      (question) => question.createdByAgentId === delegate.id,
    );
    for (const question of ownQuestions) {
      await markOpenQuestionDismissed(tauriDatabase, question.id);
      dismissed = true;
    }
  }

  if (!cancelled) {
    return;
  }
  const refreshed = await invokeAgentList(sessionId);
  set((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
  }));
  if (dismissed) {
    await get().loadSessionOpenQuestions(sessionId);
    await get().loadSessionDismissedQuestions(sessionId);
  }
};
