import type {
  Agent,
  AgentId,
  IsoDateTime,
  ModelEffort,
  OpenQuestion,
  OpenQuestionId,
  ProviderId,
  SessionId,
} from '@goodboy/types';
import {
  QUESTION_DELEGATE_SOURCE_KIND,
  canDelegateQuestion,
  composeDelegateKickoff,
  delegateAgentName,
  isLiveDelegate,
  liveQuestionDelegate,
  questionDelegates,
} from '../../../features/context/questionDelegate';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import type { GetFn } from './types';

export type QuestionDelegateRequest = {
  readonly question: OpenQuestion;
  readonly hints: string;
  readonly provider: ProviderId | '';
  readonly model: string;
  readonly effort: ModelEffort;
};

export type QuestionDelegateOutcome = {
  readonly questionId: OpenQuestionId;
  readonly agentId: AgentId | null;
  readonly kind: 'spawned' | 'already-running' | 'refused' | 'failed';
};

export type SpawnQuestionDelegatesParams = {
  readonly sessionId: SessionId;
  readonly requests: ReadonlyArray<QuestionDelegateRequest>;
};

const SPAWN_FAILED_SUMMARY = 'the delegated agent never started';

const inFlight = new Set<OpenQuestionId>();

type StrandedParams = {
  readonly sessionId: SessionId;
  readonly questionId: OpenQuestionId;
};

const settleStrandedDelegates = async ({
  sessionId,
  questionId,
}: StrandedParams): Promise<void> => {
  try {
    const listed = await invokeAgentList(sessionId);
    const stranded = questionDelegates({ agents: listed, questionId }).filter((agent) =>
      isLiveDelegate({ agent }),
    );
    for (const agent of stranded) {
      await invokeAgentUpdateStatus(agent.id, {
        status: 'failed',
        outputSummary: SPAWN_FAILED_SUMMARY,
        completedAt: new Date().toISOString() as IsoDateTime,
      });
    }
  } catch {
    return;
  }
};

const askerOf = ({
  agents,
  question,
}: {
  readonly agents: ReadonlyArray<Agent>;
  readonly question: OpenQuestion;
}): Agent | null => {
  if (question.createdByAgentId == null) {
    return null;
  }
  return agents.find((agent) => agent.id === question.createdByAgentId) ?? null;
};

export const spawnQuestionDelegates = (get: GetFn) => {
  return async ({
    sessionId,
    requests,
  }: SpawnQuestionDelegatesParams): Promise<ReadonlyArray<QuestionDelegateOutcome>> => {
    const outcomes: QuestionDelegateOutcome[] = [];

    for (const request of requests) {
      const { question } = request;
      const agents = get().sessionPhaseRuns[sessionId] ?? [];
      const asker = askerOf({ agents, question });

      if (!canDelegateQuestion({ asker })) {
        outcomes.push({ questionId: question.id, agentId: null, kind: 'refused' });
        void get().emitNotification(
          'agent-auto-spawn',
          'warning',
          'This question cannot be delegated',
          "A delegated agent can't delegate again. This one is yours to answer.",
          { sessionId, coalesceKey: `question-delegate:${question.id}` },
        );
        continue;
      }

      const live = liveQuestionDelegate({ agents, questionId: question.id });
      if (live !== null) {
        outcomes.push({ questionId: question.id, agentId: live.id, kind: 'already-running' });
        continue;
      }

      if (inFlight.has(question.id)) {
        outcomes.push({ questionId: question.id, agentId: null, kind: 'already-running' });
        continue;
      }
      inFlight.add(question.id);

      try {
        const agentId = await get().spawnAgent(sessionId, {
          kindOverride: 'scout',
          name: delegateAgentName({ questionText: question.text }),
          initialPrompt: composeDelegateKickoff({
            questionText: question.text,
            hints: request.hints,
          }),
          sourceKind: QUESTION_DELEGATE_SOURCE_KIND,
          sourceThreadId: question.id,
          ...(asker != null && { parentAgentId: asker.id }),
          ...(asker?.workflowRunId != null && { workflowRunId: asker.workflowRunId }),
          ...(request.provider !== '' && { provider: request.provider }),
          model: request.model,
          effort: request.effort,
          focus: 'none',
        });
        outcomes.push({ questionId: question.id, agentId, kind: 'spawned' });
      } catch (error) {
        await settleStrandedDelegates({ sessionId, questionId: question.id });
        outcomes.push({ questionId: question.id, agentId: null, kind: 'failed' });
        void get().emitNotification(
          'agent-auto-spawn',
          'warning',
          'The delegated agent did not start',
          `${question.text} stays open. Answer it yourself or hand it over again. ${String(error)}`,
          { sessionId, coalesceKey: `question-delegate:${question.id}` },
        );
      } finally {
        inFlight.delete(question.id);
      }
    }

    return outcomes;
  };
};
