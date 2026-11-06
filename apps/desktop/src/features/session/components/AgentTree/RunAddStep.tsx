import type { SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import { WorkflowAddStep } from '../../../workflows/components/WorkflowAddStep';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly workflowRunId: WorkflowRunId;
  readonly stepCount: number;
};

export const RunAddStep = ({ sessionId, workspaceId, workflowRunId, stepCount }: Props) => (
  <WorkflowAddStep
    sessionId={sessionId}
    workspaceId={workspaceId}
    workflowRunId={workflowRunId}
    stepCount={stepCount}
  />
);
