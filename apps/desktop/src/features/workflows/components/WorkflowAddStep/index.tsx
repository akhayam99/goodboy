import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { GhostActionButton } from '@goodboy/ui';
import type { SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { RUN_ADD_STEP_EVENT, isRunAddStepRequest } from '../../requestRunAddStep';
import { RunStepDraft } from './RunStepDraft';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly workflowRunId: WorkflowRunId;
  readonly stepCount: number;
  readonly isTriggerHidden?: boolean;
};

export const WorkflowAddStep = ({
  sessionId,
  workspaceId,
  workflowRunId,
  stepCount,
  isTriggerHidden = false,
}: Props) => {
  const isOrchestrating = useAppStore(
    (state) => state.orchestratingWorkflowRuns?.[workflowRunId] === true,
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const open = (event: Event) => {
      if (isRunAddStepRequest({ event, runId: workflowRunId })) {
        setIsOpen(true);
      }
    };
    window.addEventListener(RUN_ADD_STEP_EVENT, open);
    return () => window.removeEventListener(RUN_ADD_STEP_EVENT, open);
  }, [workflowRunId]);

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

  if (isTriggerHidden) {
    return null;
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
