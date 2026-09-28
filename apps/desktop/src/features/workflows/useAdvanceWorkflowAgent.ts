import { useCallback } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { WorkflowGateError } from '../../store/slices/workflows/workflowActivationGate';
import { notifyWorkflowGateBlock } from '../../store/slices/workflows/notifyWorkflowGateBlock';
import { isReportedError } from '../../store/slices/notifications/reportedError';

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
  const reportError = useAppStore((state) => state.reportError);

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
        if (error instanceof WorkflowGateError) {
          notifyWorkflowGateBlock({ error, sessionId, emitNotification });
          return;
        }
        if (isReportedError(error)) {
          return;
        }
        void reportError({ title: "The next step didn't start", error, sessionId });
      }
    },
    [activateWorkflowAgent, emitNotification, reportError, sessionId],
  );
};
