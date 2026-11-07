import { useMemo } from 'react';
import type {
  Agent,
  PlanWithCount,
  SessionArtifact,
  SessionId,
  SessionMountView,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { useMountRows } from '../../../../shared/hooks/useMountRows';
import { artifactBranchesOf } from '../../artifactBranchesOf';
import type { ArtifactBranchItem, ArtifactListRow } from '../../artifactListRows';
import { useArtifactMountIds } from '../useArtifactMountIds';

type Params = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<ArtifactListRow>;
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly agents: ReadonlyArray<Agent>;
};

export type ArtifactBranchItems = Readonly<{
  items: ReadonlyArray<ArtifactBranchItem>;
  mounts: ReadonlyArray<MountRowView>;
  branchCount: number;
}>;

const NO_MOUNTS: ReadonlyArray<SessionMountView> = [];

export const useArtifactBranchItems = ({
  sessionId,
  rows,
  plans,
  artifacts,
  agents,
}: Params): ArtifactBranchItems => {
  const sessionMounts = useAppStore((state) => state.sessionMounts[sessionId] ?? NO_MOUNTS);
  const projects = useAppStore((state) => state.projects);
  const mountGroups = useMountRows({ sessionId });
  const mounts = useMemo(
    () => mountGroups.flatMap((group) => [...group.rows, ...group.finishedRows]),
    [mountGroups],
  );
  const agentIds = useMemo(
    () => [
      ...plans.map((plan) => plan.agentId),
      ...artifacts.map((artifact) => artifact.agentId),
      ...rows.flatMap((row) =>
        row.target.kind === 'generation' ? [row.target.generation.agentId] : [],
      ),
    ],
    [plans, artifacts, rows],
  );
  const mountIdsByAgentId = useArtifactMountIds({ agentIds });
  return useMemo(() => {
    const items = rows.map((row) => ({
      row,
      branches: artifactBranchesOf({
        row,
        plans,
        artifacts,
        mountIdsByAgentId,
        agents,
        sessionMounts,
        projects,
      }),
    }));
    const branchCount = new Set(
      items
        .filter((item) => item.row.group !== 'deleted')
        .flatMap((item) => item.branches.map((branch) => branch.mountId)),
    ).size;
    return { items, mounts, branchCount };
  }, [rows, plans, artifacts, mountIdsByAgentId, agents, sessionMounts, projects, mounts]);
};
