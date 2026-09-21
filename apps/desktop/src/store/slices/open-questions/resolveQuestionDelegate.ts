import type { AgentId, IsoDateTime, OpenQuestionId, SessionId } from '@goodboy/types';
import { getOpenQuestionById, markOpenQuestionAnswered } from '@goodboy/db';
import { extractMarkers, extractOpenQuestionAnswer, removeQuestionsFromSlot } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { DELEGATE_NUDGE } from '../../../features/context/questionDelegate';
import { sendAnswersToSettledAgents } from './sendAnswersToSettledAgents';
import type { GetFn, SetFn } from './types';

const nudged = new Set<AgentId>();

export const resetQuestionDelegateNudges = (): void => nudged.clear();

export type ResolveQuestionDelegateParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly assistantText: string;
};

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

const refreshRuns = async ({
  set,
  get,
  sessionId,
}: Deps & { readonly sessionId: SessionId }): Promise<void> => {
  const refreshed = await invokeAgentList(sessionId);
  set((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
  }));
  void get().refreshUnreadWorkspaces();
};

export const resolveQuestionDelegate = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    agentId,
    assistantText,
  }: ResolveQuestionDelegateParams): Promise<void> => {
    const agent = (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
    const questionId = agent?.sourceThreadId as OpenQuestionId | undefined;
    if (questionId === undefined) {
      return;
    }

    const question = await getOpenQuestionById({ db: tauriDatabase, id: questionId });
    if (question === null || question.status !== 'open') {
      nudged.delete(agentId);
      await invokeAgentUpdateStatus(agentId, {
        status: 'skipped',
        completedAt: new Date().toISOString() as IsoDateTime,
      });
      await refreshRuns({ set, get, sessionId });
      return;
    }

    const answer = extractOpenQuestionAnswer({ assistantText });
    if (answer !== null) {
      nudged.delete(agentId);
      await invokeAgentUpdateStatus(agentId, {
        status: 'completed',
        outputSummary: answer,
        completedAt: new Date().toISOString() as IsoDateTime,
      });
      await refreshRuns({ set, get, sessionId });
      await markOpenQuestionAnswered(tauriDatabase, question.id, answer, {
        source: 'agent',
        agentId,
      });
      const slotChanged = await removeQuestionsFromSlot(tauriDatabase, sessionId, [question.text]);
      await get().loadSessionOpenQuestions(sessionId);
      await get().loadSessionAnsweredQuestions(sessionId);
      if (slotChanged) {
        await get().loadSessionSlots(sessionId);
      }
      await sendAnswersToSettledAgents({
        get,
        sessionId,
        askingAgentIds: new Set([question.createdByAgentId ?? null]),
      });
      return;
    }

    if (extractMarkers(assistantText).questions.length > 0) {
      return;
    }

    if (!nudged.has(agentId)) {
      nudged.add(agentId);
      await get().sendTurn({ sessionId, agentId, content: DELEGATE_NUDGE });
      return;
    }

    nudged.delete(agentId);
    await invokeAgentUpdateStatus(agentId, {
      status: 'failed',
      outputSummary: 'no answer produced for the delegated question',
      completedAt: new Date().toISOString() as IsoDateTime,
    });
    await refreshRuns({ set, get, sessionId });
    void get().emitNotification(
      'agent-auto-spawn',
      'warning',
      'The delegated agent did not answer',
      `${question.text} stays open. Answer it yourself or hand it over again.`,
      {
        sessionId,
        action: { kind: 'open-agent', sessionId, agentId },
        coalesceKey: `question-delegate:${question.id}`,
      },
    );
  };
};
