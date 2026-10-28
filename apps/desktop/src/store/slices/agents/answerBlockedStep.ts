import type { AgentId, SessionId } from '@goodboy/types';
import { composeStepBoundary } from '../turn/kickoff';
import type { GetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly text: string;
};

type FactoryParams = {
  readonly get: GetFn;
};

type PromptParams = {
  readonly agentId: AgentId;
  readonly answer: string;
};

const NOT_BLOCKED = 'This step is no longer waiting for an answer.';

const answerPrompt = ({ agentId, answer }: PromptParams): string =>
  [
    'The operator answered you:',
    answer,
    'Continue this workflow step with that answer. If the work is complete, briefly confirm the result.',
    composeStepBoundary(agentId),
  ].join('\n');

export const answerBlockedStep = ({ get }: FactoryParams) => {
  return async ({ sessionId, agentId, text }: Params): Promise<void> => {
    const answer = text.trim();
    if (answer === '') {
      return;
    }
    const agent = (get().sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === agentId,
    );
    const turn = get().agentTurnState[agentId];
    const isTurnLive = turn?.kind === 'running' || turn?.kind === 'starting';
    if (agent === undefined || agent.status !== 'blocked' || isTurnLive) {
      throw new Error(NOT_BLOCKED);
    }
    await get().sendTurn({
      sessionId,
      agentId,
      content: answerPrompt({ agentId, answer }),
      origin: 'workflow',
    });
  };
};
