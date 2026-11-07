import type {
  Agent,
  AgentId,
  MountId,
  PlanWithCount,
  SessionArtifact,
  SessionMountView,
  WorkflowRunId,
} from '@goodboy/types';
import {
  workBranchesOf,
  workBranchOf,
  type WorkBranch,
  type WorkBranchProject,
} from '../session/workBranchesOf';
import type { ArtifactListRow } from './artifactListRows';

type SourceParams = {
  readonly row: ArtifactListRow;
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
};

type ArtifactSource = Readonly<{
  agentId: AgentId;
  workflowRunId: WorkflowRunId | null;
}>;

const artifactSourceOf = ({ row, plans, artifacts }: SourceParams): ArtifactSource | null => {
  if (row.target.kind === 'generation') {
    return { agentId: row.target.generation.agentId, workflowRunId: null };
  }
  const { artifactId } = row.target;
  const plan = plans.find((candidate) => candidate.id === artifactId);
  if (plan !== undefined) {
    return { agentId: plan.agentId, workflowRunId: plan.workflowRunId ?? null };
  }
  const stored = artifacts.find((candidate) => candidate.id === artifactId);
  return stored === undefined
    ? null
    : { agentId: stored.agentId, workflowRunId: stored.workflowRunId };
};

type Params = SourceParams & {
  readonly mountIdsByAgentId: ReadonlyMap<AgentId, ReadonlyArray<MountId>>;
  readonly agents: ReadonlyArray<Agent>;
  readonly sessionMounts: ReadonlyArray<SessionMountView>;
  readonly projects: ReadonlyArray<WorkBranchProject>;
};

export const artifactBranchesOf = ({
  row,
  plans,
  artifacts,
  mountIdsByAgentId,
  agents,
  sessionMounts,
  projects,
}: Params): ReadonlyArray<WorkBranch> => {
  const source = artifactSourceOf({ row, plans, artifacts });
  if (source === null) {
    return [];
  }
  const declared = (mountIdsByAgentId.get(source.agentId) ?? []).flatMap((mountId) => {
    const branch = workBranchOf({ mountId, mounts: sessionMounts, projects });
    return branch === null ? [] : [branch];
  });
  if (declared.length > 0) {
    return declared;
  }
  const own = workBranchesOf({
    agentIds: [source.agentId],
    agents,
    mounts: sessionMounts,
    projects,
  });
  if (own.length > 0 || source.workflowRunId === null) {
    return own;
  }
  const members = agents
    .filter((agent) => agent.workflowRunId === source.workflowRunId)
    .map((agent) => agent.id);
  return workBranchesOf({ agentIds: members, agents, mounts: sessionMounts, projects });
};
