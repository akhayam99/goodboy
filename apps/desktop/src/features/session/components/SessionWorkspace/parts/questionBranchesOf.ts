import type { Agent, OpenQuestion, SessionMountView } from '@goodboy/types';
import { descendantAgentsOf } from '../../../descendantAgentsOf';
import { workBranchesOf, type WorkBranch, type WorkBranchProject } from '../../../workBranchesOf';

type Params = {
  readonly question: OpenQuestion;
  readonly agents: ReadonlyArray<Agent>;
  readonly mounts: ReadonlyArray<SessionMountView>;
  readonly projects: ReadonlyArray<WorkBranchProject>;
};

export const questionBranchesOf = ({
  question,
  agents,
  mounts,
  projects,
}: Params): ReadonlyArray<WorkBranch> => {
  const askerId = question.createdByAgentId;
  if (askerId !== undefined) {
    const family = [
      askerId,
      ...descendantAgentsOf({ agents, rootId: askerId }).map((agent) => agent.id),
    ];
    const own = workBranchesOf({ agentIds: family, agents, mounts, projects });
    if (own.length > 0) {
      return own;
    }
  }
  const runId = question.workflowRunId;
  if (runId === undefined) {
    return [];
  }
  const members = agents.filter((agent) => agent.workflowRunId === runId).map((agent) => agent.id);
  return workBranchesOf({ agentIds: members, agents, mounts, projects });
};
