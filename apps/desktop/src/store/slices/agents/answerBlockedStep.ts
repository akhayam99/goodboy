import type { AgentId, SessionId, TurnProviderOverride } from '@goodboy/types';
import { composeStepBoundary } from '../turn/kickoff';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import { clearWorkflowTurns } from '../turn/workflowTurnBreaker';
import type { GetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly text: string;
  readonly override?: TurnProviderOverride;
};

type FactoryParams = {
  readonly get: GetFn;
};

type PromptParams = {
  readonly agentId: AgentId;
  readonly answer: string;
};

const NOT_BLOCKED = 'This step is no longer waiting for an answer.';

const NOT_STARTED = 'The step did not start a turn. Your answer is back in the box.';

const answerPrompt = ({ agentId, answer }: PromptParams): string =>
  [
    'The operator answered you:',
    answer,
    'Continue this workflow step with that answer. If the work is complete, briefly confirm the result.',
    composeStepBoundary(agentId),
  ].join('\n');

export const answerBlockedStep = ({ get }: FactoryParams) => {
  return async ({ sessionId, agentId, text, override }: Params): Promise<void> => {
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
    clearWorkflowTurns({ agentId });
    let isStarted = false;
    const result = await get().sendTurn({
      sessionId,
      agentId,
      content: answerPrompt({ agentId, answer }),
      origin: 'workflow',
      onStarted: () => {
        isStarted = true;
      },
      ...(override !== undefined && { override }),
    });
    throwIfRefused({ result });
    if (!isStarted && result.isLaneQueued !== true && result.isAlreadySent !== true) {
      throw new Error(NOT_STARTED);
    }
  };
};
