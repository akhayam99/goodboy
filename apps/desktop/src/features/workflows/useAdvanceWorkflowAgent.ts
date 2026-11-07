import { useCallback } from 'react';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { advanceWorkflowAgent } from './advanceWorkflowAgent';

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
    ({ agent, isConfirmed = false }: AdvanceParams): Promise<void> =>
      advanceWorkflowAgent({
        sessionId,
        agent,
        isConfirmed,
        actions: { activateWorkflowAgent, emitNotification, reportError },
      }),
    [activateWorkflowAgent, emitNotification, reportError, sessionId],
  );
};
