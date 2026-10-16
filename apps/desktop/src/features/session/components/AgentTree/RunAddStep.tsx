import type { SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import { WorkflowAddStep } from '../../../workflows/components/WorkflowAddStep';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly workflowRunId: WorkflowRunId;
  readonly stepCount: number;
  readonly isTriggerHidden?: boolean;
};

export const RunAddStep = ({
  sessionId,
  workspaceId,
  workflowRunId,
  stepCount,
  isTriggerHidden = false,
}: Props) => (
  <WorkflowAddStep
    sessionId={sessionId}
    workspaceId={workspaceId}
    workflowRunId={workflowRunId}
    stepCount={stepCount}
    isTriggerHidden={isTriggerHidden}
  />
);
