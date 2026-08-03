import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { isWorkflowRunComplete } from './isWorkflowRunComplete';

export type AttachedRun = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

type Params = {
  readonly attachedRuns: ReadonlyArray<AttachedRun>;
  readonly agents: ReadonlyArray<Agent>;
};

export const splitWorkflowRuns = ({ attachedRuns, agents }: Params) => {
  const agentsByRunId = new Map<string, Agent[]>();
  for (const agent of agents) {
    if (agent.workflowRunId == null || agent.stepId == null || agent.parentAgentId != null) {
      continue;
    }
    const forRun = agentsByRunId.get(agent.workflowRunId) ?? [];
    forRun.push(agent);
    agentsByRunId.set(agent.workflowRunId, forRun);
  }

  const discarded = attachedRuns.filter(({ run }) => run.discardedAt != null);
  const live = attachedRuns.filter(({ run }) => run.discardedAt == null);
  const completed = live.filter(({ run, workflow }) =>
    isWorkflowRunComplete({ run, workflow, agents: agentsByRunId.get(run.id) ?? [] }),
  );
  const active = live.filter((entry) => !completed.includes(entry));

  return { agentsByRunId, discarded, completed, active };
};
