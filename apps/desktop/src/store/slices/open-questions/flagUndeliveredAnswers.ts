import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { answersInFlight } from './answersInFlight';
import { recordPendingOpenQuestionDelivery } from './pendingOpenQuestionDelivery';
import type { AskingAgentId } from './sendAnswersToSettledAgents';

type Params = Readonly<{
  sessionId: SessionId;
}>;

const NOT_DELIVERED_ON_LOAD = 'These answers were saved but never reached the agent.';

export const flagUndeliveredAnswers = ({ set, get }: SliceDeps) => {
  return ({ sessionId }: Params): void => {
    const state = get();
    const open = state.sessionOpenQuestions[sessionId];
    const answered = state.sessionAnsweredQuestions[sessionId];
    if (
      open === undefined ||
      answered === undefined ||
      state.pendingOpenQuestionDeliveries[sessionId] !== undefined ||
      answersInFlight.has({ sessionId })
    ) {
      return;
    }
    const waitingAgents = new Set<AskingAgentId>(
      open.map((question) => question.createdByAgentId ?? null),
    );
    const liveAgents = new Set((state.sessionPhaseRuns[sessionId] ?? []).map((agent) => agent.id));
    const undelivered = answered.filter(
      (question) =>
        question.answerDeliveredAt === undefined &&
        question.userAnswer !== null &&
        question.createdByAgentId != null &&
        liveAgents.has(question.createdByAgentId) &&
        !waitingAgents.has(question.createdByAgentId),
    );
    if (undelivered.length === 0) {
      return;
    }
    recordPendingOpenQuestionDelivery({
      set,
      sessionId,
      pending: {
        attemptId: `load:${sessionId}`,
        pairs: undelivered.map((question) => ({
          id: question.id,
          text: question.text,
          answer: question.userAnswer ?? '',
        })),
        askingAgentIds: [
          ...new Set(undelivered.map((question) => question.createdByAgentId ?? null)),
        ],
        error: NOT_DELIVERED_ON_LOAD,
      },
    });
  };
};
