import type { OrchestratorRouting, SessionId, WorkflowRunId } from '@goodboy/types';
import type { SetFn } from '../types';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly routing: OrchestratorRouting | undefined;
  readonly shouldBypassGate: boolean;
};

export const queuePendingOrchestration = ({
  set,
  sessionId,
  workflowRunId,
  routing: requested,
  shouldBypassGate,
}: Params): void => {
  set((state) => {
    const previous = state.pendingOrchestrations?.[workflowRunId];
    const routing = requested ?? previous?.routing;
    return {
      pendingOrchestrations: {
        ...(state.pendingOrchestrations ?? {}),
        [workflowRunId]: {
          sessionId,
          bypassGate: (previous?.bypassGate ?? false) || shouldBypassGate,
          ...(routing != null && { routing }),
        },
      },
    };
  });
};
