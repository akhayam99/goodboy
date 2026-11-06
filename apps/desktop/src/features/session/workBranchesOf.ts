import type { Agent, AgentId, MountId, ProjectId, SessionMountView } from '@goodboy/types';
import { inheritedMountIdOf } from '../../store/slices/workflows/runMount/inheritedMountIdOf';

export type WorkBranch = Readonly<{
  mountId: MountId;
  projectId: ProjectId;
  projectName: string;
  branch: string;
}>;

export type WorkBranchProject = Readonly<{
  id: ProjectId;
  name: string;
}>;

type Params = {
  readonly agentIds: ReadonlyArray<AgentId>;
  readonly agents: ReadonlyArray<Agent>;
  readonly mounts: ReadonlyArray<SessionMountView>;
  readonly projects: ReadonlyArray<WorkBranchProject>;
};

type MountParams = {
  readonly agent: Agent;
  readonly agents: ReadonlyArray<Agent>;
};

const mountIdOf = ({ agent, agents }: MountParams): MountId | null =>
  agent.mountId ?? inheritedMountIdOf({ agents, workflowRunId: agent.workflowRunId ?? null });

export const workBranchesOf = ({
  agentIds,
  agents,
  mounts,
  projects,
}: Params): ReadonlyArray<WorkBranch> => {
  const members = new Set<string>(agentIds);
  const found = new Map<string, WorkBranch>();
  for (const agent of agents) {
    if (!members.has(agent.id)) {
      continue;
    }
    const mountId = mountIdOf({ agent, agents });
    if (mountId === null || found.has(mountId)) {
      continue;
    }
    const mount = mounts.find((candidate) => candidate.id === mountId);
    if (mount === undefined || !mount.isAttached) {
      continue;
    }
    const project = projects.find((candidate) => candidate.id === mount.projectId);
    found.set(mountId, {
      mountId,
      projectId: mount.projectId,
      projectName: project?.name ?? mount.mountName,
      branch: mount.branch,
    });
  }
  return [...found.values()];
};
