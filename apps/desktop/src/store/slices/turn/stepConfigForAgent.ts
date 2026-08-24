import type { Agent, Session, Step, Workflow } from '@goodboy/types';

type Params = {
  readonly agent: Agent | null;
  readonly session: Session;
  readonly workflows: ReadonlyArray<Workflow> | null;
};

export const stepConfigForAgent = ({ agent, session, workflows }: Params): Step | null => {
  if (agent?.stepId == null || workflows == null) {
    return null;
  }
  const run =
    agent.workflowRunId != null
      ? session.workflowRuns.find((candidate) => candidate.id === agent.workflowRunId)
      : undefined;
  if (run != null) {
    const workflow = workflows.find((candidate) => candidate.id === run.workflowId);
    return workflow?.steps.find((candidate) => candidate.id === agent.stepId) ?? null;
  }
  const attachedIds = new Set(session.workflowRuns.map((candidate) => candidate.workflowId));
  for (const workflow of workflows) {
    if (!attachedIds.has(workflow.id)) {
      continue;
    }
    const found = workflow.steps.find((candidate) => candidate.id === agent.stepId);
    if (found != null) {
      return found;
    }
  }
  return null;
};
