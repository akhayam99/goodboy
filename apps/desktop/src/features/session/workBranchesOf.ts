import type { Agent, AgentId, MountId, ProjectId, SessionMountView } from '@goodboy/types';
import { projectById } from '../../store/slices/projects/projectIndex';
import { inheritedMountIdOf } from '../../store/slices/workflows/runMount/inheritedMountIdOf';
import { NO_TOUCHED_MOUNT_IDS, type TouchedMountIds } from './touchedMountIdsOf';
import { soleMountIdOf } from './soleMountIdOf';

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
  readonly isDetachedIncluded?: boolean;
  readonly touchedMountIds?: TouchedMountIds;
};

type MountParams = {
  readonly agent: Agent;
  readonly agents: ReadonlyArray<Agent>;
  readonly soleMountId: MountId | null;
};

const stepMountIdOf = ({ agent, agents, soleMountId }: MountParams): MountId | null =>
  agent.mountId ??
  inheritedMountIdOf({ agents, workflowRunId: agent.workflowRunId ?? null }) ??
  soleMountId;

type MountBranchParams = {
  readonly mountId: MountId;
  readonly mounts: ReadonlyArray<SessionMountView>;
  readonly projects: ReadonlyArray<WorkBranchProject>;
  readonly isDetachedIncluded?: boolean;
};

export const workBranchOf = ({
  mountId,
  mounts,
  projects,
  isDetachedIncluded,
}: MountBranchParams): WorkBranch | null => {
  const mount = mounts.find((candidate) => candidate.id === mountId);
  if (mount === undefined || (!mount.isAttached && isDetachedIncluded !== true)) {
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
  isDetachedIncluded,
  touchedMountIds = NO_TOUCHED_MOUNT_IDS,
}: Params): ReadonlyArray<WorkBranch> => {
  const members = new Set<string>(agentIds);
  const found = new Map<string, WorkBranch>();
  const soleMountId = soleMountIdOf({ mounts });
  for (const agent of agents) {
    if (!members.has(agent.id)) {
      continue;
    }
    const stepMountId = stepMountIdOf({ agent, agents, soleMountId });
    const mountIds = [
      ...(stepMountId === null ? [] : [stepMountId]),
      ...(touchedMountIds.get(agent.id) ?? []),
    ];
    for (const mountId of mountIds) {
      if (found.has(mountId)) {
        continue;
      }
      const branch = workBranchOf({ mountId, mounts, projects, isDetachedIncluded });
      if (branch !== null) {
        found.set(mountId, branch);
      }
    }
  }
  return [...found.values()];
};
