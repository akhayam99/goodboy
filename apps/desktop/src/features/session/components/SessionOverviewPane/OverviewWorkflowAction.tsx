import type { Agent, Session, StepId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { OverviewNextStep } from './OverviewNextStep';

type Props = {
  readonly session: Session;
  readonly runId: WorkflowRunId;
  readonly stepId: StepId;
  readonly runAgents: ReadonlyArray<Agent>;
};

export const OverviewWorkflowAction = ({ session, runId, stepId, runAgents }: Props) => {
  const run = session.workflowRuns.find((candidate) => candidate.id === runId) ?? null;
  const phaseWorkflow = useAppStore((state) =>
    run == null
      ? null
      : (state.phaseTemplates[session.workspaceId]?.find(
          (candidate) => candidate.id === run.workflowId,
        ) ?? null),
  );
  const sessionWorkflow = useAppStore((state) =>
    run == null
      ? null
      : (state.sessionWorkflows[session.id]?.find((candidate) => candidate.id === run.workflowId) ??
        null),
  );
  const workflow = sessionWorkflow ?? phaseWorkflow;
  if (workflow == null) {
    return null;
  }
  return (
    <OverviewNextStep
      sessionId={session.id}
      workflow={workflow}
      runAgents={runAgents}
      stepId={stepId}
    />
  );
};
