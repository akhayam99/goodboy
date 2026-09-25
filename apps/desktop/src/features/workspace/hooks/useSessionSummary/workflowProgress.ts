import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';

export type AttachedRun = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

export type WorkflowProgress = {
  readonly label: string;
  readonly current: number;
  readonly total: number;
};

type Params = {
  readonly runs: ReadonlyArray<AttachedRun>;
  readonly agents: ReadonlyArray<Agent>;
};

type RunParams = {
  readonly attached: AttachedRun;
  readonly agents: ReadonlyArray<Agent>;
};

const isSettled = ({ status }: Pick<Agent, 'status'>): boolean =>
  status === 'completed' || status === 'skipped';

const progressOfRun = ({ attached, agents }: RunParams): WorkflowProgress | null => {
  const { run, workflow } = attached;
  if (run.discardedAt != null || run.executionMode === 'dynamic') {
    return null;
  }
  const steps = workflow.steps
    .filter((step) => step.deletedAt == null)
    .sort((first, second) => first.ordinal - second.ordinal);
  const stepAgents = agents.filter(
    (agent) =>
      agent.workflowRunId === run.id && agent.stepId != null && agent.parentAgentId == null,
  );
  if (steps.length === 0 || stepAgents.length === 0) {
    return null;
  }
  const started = steps.filter((step) =>
    stepAgents.some((agent) => agent.stepId === step.id && agent.status !== 'pending'),
  );
  const settled = steps.filter((step) =>
    stepAgents.some((agent) => agent.stepId === step.id && isSettled(agent)),
  );
  if (settled.length >= steps.length) {
    return null;
  }
  const labelStep = started[started.length - 1] ?? steps[0];
  if (labelStep === undefined) {
    return null;
  }
  return { label: labelStep.name, current: started.length, total: steps.length };
};

export const workflowProgress = ({ runs, agents }: Params): WorkflowProgress | null => {
  for (const attached of runs) {
    const progress = progressOfRun({ attached, agents });
    if (progress !== null) {
      return progress;
    }
  }
  return null;
};
