import type { AgentId, SessionId } from '@goodboy/types';
import { notFinishedKindOf } from '@goodboy/core/workflows';
import { composeStepBoundary } from '../turn/kickoff';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import type { GetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

type FactoryParams = {
  readonly get: GetFn;
};

type PromptParams = {
  readonly agentId: AgentId;
};

const NOT_UNFINISHED = 'This step is not waiting to be finished.';

const keepWorkingPrompt = ({ agentId }: PromptParams): string =>
  [
    'You stopped before finishing this workflow step and it was skipped, so the run went on without it.',
    'Keep working on it now and finish what is missing.',
    composeStepBoundary(agentId),
  ].join('\n');

export const keepWorkingOnStep = ({ get }: FactoryParams) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    const agent = (get().sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === agentId,
    );
    const turn = get().agentTurnState[agentId];
    const isTurnLive = turn?.kind === 'running' || turn?.kind === 'starting';
    if (agent === undefined || notFinishedKindOf({ agent }) !== 'stuck' || isTurnLive) {
      throw new Error(NOT_UNFINISHED);
    }
    throwIfRefused({
      result: await get().sendTurn({
        sessionId,
        agentId,
        content: keepWorkingPrompt({ agentId }),
        origin: 'workflow',
      }),
    });
  };
};
