import { useEffect, useState } from 'react';
import type { SessionId, Workflow, WorkflowRun } from '@goodboy/types';
import { WorkflowNodeRouting } from '../../../workflows/components/WorkflowNodeRouting';
import {
  STEP_ROUTING_REQUEST_EVENT,
  isStepRoutingRequest,
} from '../../../workflows/requestStepRouting';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export const OrchestratedRouting = ({ sessionId, run, workflow }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onRequest = (event: Event) => {
      if (isStepRoutingRequest({ event, runId: run.id })) {
        setIsOpen(true);
      }
    };
    window.addEventListener(STEP_ROUTING_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(STEP_ROUTING_REQUEST_EVENT, onRequest);
  }, [run.id]);

  if (!isOpen) {
    return null;
  }
  return (
    <WorkflowNodeRouting
      sessionId={sessionId}
      workflowRunId={run.id}
      steps={workflow.steps}
      onClose={() => setIsOpen(false)}
    />
  );
};
