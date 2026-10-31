import type { AgentId, SessionId } from '@goodboy/types';
import { cancelQuestionDelegates } from './cancelQuestionDelegates';
import {
  persistOpenQuestionAnswers,
  type OpenQuestionAnswerPair,
} from './persistOpenQuestionAnswers';
import { formatError } from '@goodboy/ui';
import { OpenQuestionDeliveryError } from './openQuestionDeliveryError';
import {
  clearPendingOpenQuestionDelivery,
  recordPendingOpenQuestionDelivery,
} from './pendingOpenQuestionDelivery';
import { sendAnswersToSettledAgents, type AskingAgentId } from './sendAnswersToSettledAgents';
import { clearAnswersInFlight, isQuestionHeldByStop, markAnswersInFlight } from './heldAnswers';
import type { GetFn, SetFn } from './types';

type ResolveAskingAgentsParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly pairs: ReadonlyArray<OpenQuestionAnswerPair>;
  readonly targetAgentId: AgentId | null;
};

const resolveAskingAgents = ({
  get,
  sessionId,
  pairs,
  targetAgentId,
}: ResolveAskingAgentsParams): ReadonlySet<AskingAgentId> => {
  const open = get().sessionOpenQuestions[sessionId] ?? [];
  const questionById = new Map(open.map((question) => [question.id, question]));
  const agents = new Set<AskingAgentId>();
  for (const pair of pairs) {
    const known = questionById.get(pair.id);
    if (known === undefined) {
      agents.add(targetAgentId);
      continue;
    }
    if (isQuestionHeldByStop({ get, sessionId, question: known })) {
      continue;
    }
    agents.add(known.createdByAgentId ?? null);
  }
  return agents;
};

export const answerOpenQuestions = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    pairs: ReadonlyArray<OpenQuestionAnswerPair>,
    targetAgentId: AgentId | null,
  ) => {
    const valid = pairs.filter((pair) => pair.answer.trim().length > 0);
    if (valid.length === 0) {
      return;
    }

    const askingAgentIds = resolveAskingAgents({ get, sessionId, pairs: valid, targetAgentId });
    markAnswersInFlight({ sessionId });
    try {
      await cancelQuestionDelegates({
        set,
        get,
        sessionId,
        questionIds: valid.map((pair) => pair.id),
      });
      await persistOpenQuestionAnswers({ get, sessionId, pairs: valid });
    } catch (cause) {
      clearAnswersInFlight({ sessionId });
      throw cause;
    }
    const attemptId = crypto.randomUUID();
    try {
      await sendAnswersToSettledAgents({ get, sessionId, askingAgentIds });
      clearPendingOpenQuestionDelivery({ set, sessionId, attemptId });
    } catch (cause) {
      const error = formatError(cause);
      recordPendingOpenQuestionDelivery({
        set,
        sessionId,
        pending: { attemptId, pairs: valid, askingAgentIds: [...askingAgentIds], error },
      });
      throw new OpenQuestionDeliveryError(error);
    } finally {
      clearAnswersInFlight({ sessionId });
      void get().maybeAutoAdvanceWorkflow(sessionId);
    }
  };
};
