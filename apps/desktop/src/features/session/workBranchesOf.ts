import type { Agent, AgentId, MountId, ProjectId, SessionMountView } from '@goodboy/types';
import { projectById } from '../../store/slices/projects/projectIndex';
import { inheritedMountIdOf } from '../../store/slices/workflows/runMount/inheritedMountIdOf';

export type WorkBranch = Readonly<{
  mountId: MountId;
  projectId: ProjectId;
  projectName: string;
  branch: string;
  worktreePath: string | null;
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

const stepMountIdOf = ({ agent, agents }: MountParams): MountId | null =>
  agent.mountId ?? inheritedMountIdOf({ agents, workflowRunId: agent.workflowRunId ?? null });

type MountBranchParams = {
  readonly mountId: MountId;
  readonly mounts: ReadonlyArray<SessionMountView>;
  readonly projects: ReadonlyArray<WorkBranchProject>;
};

export const workBranchOf = ({
  mountId,
  mounts,
  projects,
}: MountBranchParams): WorkBranch | null => {
  const mount = mounts.find((candidate) => candidate.id === mountId);
  if (mount === undefined || !mount.isAttached) {
    return null;
  }
  const project = projectById(projects, mount.projectId);
  return {
    mountId,
    projectId: mount.projectId,
    projectName: project?.name ?? mount.mountName,
    branch: mount.branch,
    worktreePath: mount.worktreePath,
  };
};

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
    const mountId = stepMountIdOf({ agent, agents });
    if (mountId === null || found.has(mountId)) {
      continue;
    }
    const branch = workBranchOf({ mountId, mounts, projects });
    if (branch === null) {
      continue;
    }
    found.set(mountId, branch);
  }
  return [...found.values()];
};
