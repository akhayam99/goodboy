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
  const everyAgentByRunId = new Map<string, Agent[]>();
  for (const agent of agents) {
    if (agent.workflowRunId == null) {
      continue;
    }
    const everyForRun = everyAgentByRunId.get(agent.workflowRunId) ?? [];
    everyForRun.push(agent);
    everyAgentByRunId.set(agent.workflowRunId, everyForRun);
    if (agent.stepId == null || agent.parentAgentId != null) {
      continue;
    }
    const forRun = agentsByRunId.get(agent.workflowRunId) ?? [];
    forRun.push(agent);
    agentsByRunId.set(agent.workflowRunId, forRun);
  }

  const discarded = attachedRuns.filter(({ run }) => run.discardedAt != null);
  const live = attachedRuns.filter(({ run }) => run.discardedAt == null);
  const completed = live.filter(({ run, workflow }) =>
    isWorkflowRunComplete({ run, workflow, agents: everyAgentByRunId.get(run.id) ?? [] }),
  );
  const active = live.filter((entry) => !completed.includes(entry));

  return { agentsByRunId, discarded, completed, active };
};
