import type { Agent, AgentId, SessionMountView } from '@goodboy/types';
import type { SessionRun } from './sessionRunsOf';
import { workBranchesOf, type WorkBranchProject } from './workBranchesOf';

export const AGENT_BRANCH_RUN_FLOOR = 2;

type Params = {
  readonly runs: ReadonlyArray<SessionRun>;
  readonly agents: ReadonlyArray<Agent>;
  readonly mounts: ReadonlyArray<SessionMountView>;
  readonly projects: ReadonlyArray<WorkBranchProject>;
};

export const agentBranchLabelsOf = ({
  runs,
  agents,
  mounts,
  projects,
}: Params): ReadonlyMap<AgentId, string> => {
  const labels = new Map<AgentId, string>();
  for (const run of runs) {
    if (run.branches.length < AGENT_BRANCH_RUN_FLOOR) {
      continue;
    }
    for (const agentId of run.agentIds) {
      const [own, ...others] = workBranchesOf({ agentIds: [agentId], agents, mounts, projects });
      if (own !== undefined && others.length === 0) {
        labels.set(agentId, own.branch);
      }
    }
  }
  return labels;
};
