import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import type { Agent, SessionId } from '@goodboy/types';
import type { useAppStore } from '../../store';
import { WorkflowGateError } from '../../store/slices/workflows/workflowActivationGate';
import { notifyWorkflowGateBlock } from '../../store/slices/workflows/notifyWorkflowGateBlock';
import { isReportedError } from '../../store/slices/notifications/reportedError';

type State = ReturnType<typeof useAppStore.getState>;

type Actions = Pick<State, 'activateWorkflowAgent' | 'emitNotification' | 'reportError'>;

type Params = {
  readonly sessionId: SessionId;
  readonly agent: Agent | null;
  readonly isConfirmed?: boolean;
  readonly actions: Actions;
};

export const advanceWorkflowAgent = async ({
  sessionId,
  agent,
  isConfirmed = false,
  actions,
}: Params): Promise<void> => {
  if (agent == null || agent.status !== 'pending') {
    return;
  }
  try {
    await actions.activateWorkflowAgent({
      sessionId,
      agentId: agent.id,
      focus: 'none',
      bypassGate: isConfirmed,
    });
  } catch (error) {
    if (error instanceof WorkflowGateError) {
      notifyWorkflowGateBlock({
        error,
        sessionId,
        emitNotification: actions.emitNotification,
      });
      return;
    }
    if (isReportedError(error)) {
      return;
    }
    void actions.reportError({
      recovery: CHECK_STATE,
      title: "The next step didn't start",
      error,
      sessionId,
    });
  }
};
