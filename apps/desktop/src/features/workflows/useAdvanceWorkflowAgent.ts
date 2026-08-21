import { useCallback } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { notifyWorkflowGateBlock } from '../../store/slices/workflows/notifyWorkflowGateBlock';

type Params = {
  readonly sessionId: SessionId;
};

type AdvanceParams = {
  readonly agent: Agent | null;
  readonly isConfirmed?: boolean;
};

export const useAdvanceWorkflowAgent = ({
  sessionId,
}: Params): ((params: AdvanceParams) => Promise<void>) => {
  const activateWorkflowAgent = useAppStore((state) => state.activateWorkflowAgent);
  const emitNotification = useAppStore((state) => state.emitNotification);

  return useCallback(
    async ({ agent, isConfirmed = false }: AdvanceParams): Promise<void> => {
      if (agent == null || agent.status !== 'pending') {
        return;
      }
      try {
        await activateWorkflowAgent({
          sessionId,
          agentId: agent.id,
          focus: 'none',
          bypassGate: isConfirmed,
        });
      } catch (error) {
        notifyWorkflowGateBlock({ error, sessionId, emitNotification });
      }
    },
    [activateWorkflowAgent, emitNotification, sessionId],
  );
};
