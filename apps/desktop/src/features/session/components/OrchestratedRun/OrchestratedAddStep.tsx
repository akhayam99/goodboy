import type { SessionId } from '@goodboy/types';
import { RunAddStep } from '../AgentTree/RunAddStep';
import type { RunView } from '../AgentTree/useRunView';

type Props = {
  readonly sessionId: SessionId;
  readonly view: RunView;
};

export const OrchestratedAddStep = ({ sessionId, view }: Props) => {
  if (view.isDiscarded || view.isOrchestrating) {
    return null;
  }
  return (
    <RunAddStep
      sessionId={sessionId}
      workspaceId={view.workflow.workspaceId}
      workflowRunId={view.run.id}
      stepCount={view.stepCount}
    />
  );
};
