import type { OpenQuestion, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { findWorkflowRun } from '../workflows/findWorkflowRun';
import { sessionById } from '../sessions/sessionIndex';
import { recordPendingOpenQuestionDelivery } from './pendingOpenQuestionDelivery';
import { sendAnswersToSettledAgents, type AskingAgentId } from './sendAnswersToSettledAgents';
import type { GetFn, SetFn } from './types';

const answersInFlight = new Set<SessionId>();

type FlightParams = {
  readonly sessionId: SessionId;
};

export const markAnswersInFlight = ({ sessionId }: FlightParams): void => {
  answersInFlight.add(sessionId);
};

export const clearAnswersInFlight = ({ sessionId }: FlightParams): void => {
  answersInFlight.delete(sessionId);
};

type QuestionParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly question: Pick<OpenQuestion, 'workflowRunId'>;
};

export const isQuestionHeldByStop = ({ get, sessionId, question }: QuestionParams): boolean => {
  if (question.workflowRunId == null) {
    return false;
  }
  const kind = findWorkflowRun({ get, sessionId, workflowRunId: question.workflowRunId })
    ?.orchestrationStop?.kind;
  return kind != null && kind !== 'questions';
};

type DeliverParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const deliverHeldAnswers = async ({ set, get, sessionId }: DeliverParams): Promise<void> => {
  if (
    answersInFlight.has(sessionId) ||
    (get().pendingOpenQuestionDeliveries ?? {})[sessionId] != null
  ) {
    return;
  }
  const runs = sessionById(get().sessions, sessionId)?.workflowRuns ?? [];
  const answered = (get().sessionAnsweredQuestions ?? {})[sessionId] ?? [];
  for (const run of runs) {
    if (run.discardedAt != null || run.orchestrationStop != null) {
      continue;
    }
    const undelivered = answered.filter(
      (question) =>
        question.workflowRunId === run.id &&
        question.answerDeliveredAt === undefined &&
        question.userAnswer !== null,
    );
    if (undelivered.length === 0) {
      continue;
    }
    const askingAgentIds = new Set<AskingAgentId>(
      undelivered.map((question) => question.createdByAgentId ?? null),
    );
    try {
      await sendAnswersToSettledAgents({ get, sessionId, askingAgentIds });
    } catch (cause) {
      recordPendingOpenQuestionDelivery({
        set,
        sessionId,
        pending: {
          attemptId: crypto.randomUUID(),
          pairs: undelivered.map((question) => ({
            id: question.id,
            text: question.text,
            answer: question.userAnswer ?? '',
          })),
          askingAgentIds: [...askingAgentIds],
          error: formatError(cause),
        },
      });
      return;
    }
  }
};
