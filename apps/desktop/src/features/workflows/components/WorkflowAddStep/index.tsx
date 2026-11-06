import { useState } from 'react';
import { Plus } from 'lucide-react';
import { GhostActionButton } from '@goodboy/ui';
import type { SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RunStepDraft } from './RunStepDraft';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly workflowRunId: WorkflowRunId;
  readonly stepCount: number;
};

export const WorkflowAddStep = ({ sessionId, workspaceId, workflowRunId, stepCount }: Props) => {
  const isOrchestrating = useAppStore(
    (state) => state.orchestratingWorkflowRuns?.[workflowRunId] === true,
  );
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return (
      <RunStepDraft
        sessionId={sessionId}
        workspaceId={workspaceId}
        workflowRunId={workflowRunId}
        stepCount={stepCount}
        isOrchestrating={isOrchestrating}
        onClose={() => setIsOpen(false)}
      />
    );
  }

  return (
    <GhostActionButton
      icon={Plus}
      label="Add step"
      title={
        isOrchestrating
          ? 'The orchestrator is choosing the next step'
          : 'Append one more agent to this run'
      }
      disabled={isOrchestrating}
      onClick={() => setIsOpen(true)}
    />
  );
};
