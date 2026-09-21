import type { IsoDateTime, OpenQuestionId, SessionId } from '@goodboy/types';
import { markOpenQuestionDismissed } from '@goodboy/db';
import { removeQuestionsFromSlot } from '@goodboy/core';
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
  const dismissedTexts: string[] = [];

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
      dismissedTexts.push(question.text);
    }
  }

  if (!cancelled) {
    return;
  }
  const refreshed = await invokeAgentList(sessionId);
  set((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
  }));
  if (dismissedTexts.length === 0) {
    return;
  }
  await get().loadSessionOpenQuestions(sessionId);
  await get().loadSessionDismissedQuestions(sessionId);
  const slotChanged = await removeQuestionsFromSlot(tauriDatabase, sessionId, dismissedTexts);
  if (slotChanged) {
    await get().loadSessionSlots(sessionId);
  }
};
