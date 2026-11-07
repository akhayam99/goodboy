import { isAgentStatusSettled } from '@goodboy/core/workflows';
import { formatError } from '@goodboy/ui';
import type { AgentId, SessionId, TurnProviderOverride } from '@goodboy/types';
import { waitTurnSettled } from '../turn/turnSettled';
import { composeStepBoundary } from '../turn/kickoff';
import { throwIfRefused } from '../turn/refusal/throwIfRefused';
import { clearWorkflowTurns } from '../turn/workflowTurnBreaker';
import type { GetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly override?: TurnProviderOverride;
};

const continuePrompt = ({ agentId }: { readonly agentId: AgentId }): string =>
  [
    'You have been quiet for a while. Check where this workflow step stands.',
    'If a command is hanging, stop it. If work remains, finish it. If the work is complete, briefly confirm the result.',
    composeStepBoundary(agentId),
  ].join('\n');

export const askAgentToContinue = (get: GetFn) => {
  return async ({ sessionId, agentId, override }: Params): Promise<void> => {
    try {
      const agent = (get().sessionPhaseRuns[sessionId] ?? []).find(
        (candidate) => candidate.id === agentId,
      );
      if (agent == null || isAgentStatusSettled({ status: agent.status })) {
        return;
      }
      const turn = get().agentTurnState[agentId];
      if (turn?.kind === 'running' || turn?.kind === 'starting') {
        await get().cancelCurrentTurn(sessionId, agentId, 'handoff');
        await waitTurnSettled({ agentId });
      }
      clearWorkflowTurns({ agentId });
      throwIfRefused({
        result: await get().sendTurn({
          sessionId,
          agentId,
          content: continuePrompt({ agentId }),
          origin: 'workflow',
          ...(override !== undefined && { override }),
        }),
      });
    } catch (error) {
      void get().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "Couldn't ask the agent to continue",
        body: `${formatError(error).replace(/\.$/, '')}. You can still skip this step.`,
        sessionId,
      });
    }
  };
};
