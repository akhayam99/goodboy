import type { AgentId, SessionId } from '@goodboy/types';
import { cancelQuestionDelegates } from './cancelQuestionDelegates';
import {
  persistOpenQuestionAnswers,
  type OpenQuestionAnswerPair,
} from './persistOpenQuestionAnswers';
import { sendAnswersToSettledAgents, type AskingAgentId } from './sendAnswersToSettledAgents';
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
  const askingAgentByQuestionId = new Map<string, AskingAgentId>(
    open.map((question) => [question.id, question.createdByAgentId ?? null]),
  );
  const agents = new Set<AskingAgentId>();
  for (const pair of pairs) {
    const known = askingAgentByQuestionId.get(pair.id);
    agents.add(known === undefined ? targetAgentId : known);
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
    await cancelQuestionDelegates({
      set,
      get,
      sessionId,
      questionIds: valid.map((pair) => pair.id),
    });
    await persistOpenQuestionAnswers({ get, sessionId, pairs: valid });
    await sendAnswersToSettledAgents({ get, sessionId, askingAgentIds });
  };
};
