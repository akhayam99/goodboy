import type { OpenQuestionId, SessionId, WorkflowRunId } from '@goodboy/types';
import { listOpenQuestionsForSession } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';
import { findWorkflowRun } from '../workflows/findWorkflowRun';
import { recordPendingOpenQuestionDelivery } from './pendingOpenQuestionDelivery';
import { sendAnswersToSettledAgents, type AskingAgentId } from './sendAnswersToSettledAgents';
import type { GetFn, SetFn } from './types';

const answersInFlight = new Map<SessionId, number>();
const heldQuestionIds = new Set<OpenQuestionId>();
const deliveries = createSerialQueue();

type HeldParams = {
  readonly ids: ReadonlyArray<OpenQuestionId>;
};

export const markAnswersHeld = ({ ids }: HeldParams): void => {
  ids.forEach((id) => heldQuestionIds.add(id));
};

type FlightParams = {
  readonly sessionId: SessionId;
};

export const markAnswersInFlight = ({ sessionId }: FlightParams): void => {
  answersInFlight.set(sessionId, (answersInFlight.get(sessionId) ?? 0) + 1);
};

export const clearAnswersInFlight = ({ sessionId }: FlightParams): void => {
  const remaining = (answersInFlight.get(sessionId) ?? 0) - 1;
  if (remaining > 0) {
    answersInFlight.set(sessionId, remaining);
    return;
  }
  answersInFlight.delete(sessionId);
};

export type HeldAnswersOutcome = 'clear' | 'blocked';

type SettleParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly isStopIgnored: boolean;
};

const settleRunAnswers = async ({
  set,
  get,
  sessionId,
  workflowRunId,
  isStopIgnored,
}: SettleParams): Promise<HeldAnswersOutcome> => {
  const answered = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'answered');
  const undelivered = answered.filter(
    (question) =>
      question.workflowRunId === workflowRunId &&
      question.answerDeliveredAt === undefined &&
      question.userAnswer !== null,
  );
  if (undelivered.length === 0) {
    return 'clear';
  }
  const run = findWorkflowRun({ get, sessionId, workflowRunId });
  if (run == null || run.discardedAt != null || (!isStopIgnored && run.orchestrationStop != null)) {
    return 'clear';
  }
  const isHeld = undelivered.some((question) => heldQuestionIds.has(question.id));
  if (answersInFlight.has(sessionId)) {
    return 'blocked';
  }
  if ((get().pendingOpenQuestionDeliveries ?? {})[sessionId] != null) {
    return isHeld ? 'blocked' : 'clear';
  }
  const open = await listOpenQuestionsForSession(tauriDatabase, sessionId, 'open');
  set((state) => ({
    sessionAnsweredQuestions: { ...state.sessionAnsweredQuestions, [sessionId]: answered },
    sessionOpenQuestions: { ...state.sessionOpenQuestions, [sessionId]: open },
  }));
  const askingAgentIds = new Set<AskingAgentId>(
    undelivered.map((question) => question.createdByAgentId ?? null),
  );
  markAnswersInFlight({ sessionId });
  try {
    await sendAnswersToSettledAgents({
      get,
      sessionId,
      askingAgentIds,
      run: { id: workflowRunId, isStopIgnored },
    });
    undelivered.forEach((question) => heldQuestionIds.delete(question.id));
    return 'clear';
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
    return isHeld ? 'blocked' : 'clear';
  } finally {
    clearAnswersInFlight({ sessionId });
  }
};

export const settleHeldAnswers = ({
  set,
  get,
  sessionId,
  workflowRunId,
  isStopIgnored,
}: SettleParams): Promise<HeldAnswersOutcome> =>
  deliveries.run({
    key: sessionId,
    task: () => settleRunAnswers({ set, get, sessionId, workflowRunId, isStopIgnored }),
  });
