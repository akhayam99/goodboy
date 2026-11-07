import { useMemo } from 'react';
import type {
  Agent,
  AgentId,
  MountId,
  PlanWithCount,
  SessionArtifact,
  SessionId,
  SessionMountView,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { useMountRows } from '../../../../shared/hooks/useMountRows';
import { namedBranchGroupCountOf } from '../../../session/branchGroupsOf';
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
const NO_DECLARED: ReadonlyMap<AgentId, ReadonlyArray<MountId>> = new Map();

type BranchesParams = {
  readonly row: ArtifactListRow;
  readonly declared: ReadonlyMap<AgentId, ReadonlyArray<MountId>>;
};

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
  const phaseKey = useMemo(
    () => rows.map((row) => `${row.id}:${row.group}:${row.state?.key ?? ''}`).join(','),
    [rows],
  );
  const { mountIdsByAgentId, isSettled } = useArtifactMountIds({ agentIds, phaseKey });
  return useMemo(() => {
    const branchesOf = ({ row, declared }: BranchesParams) =>
      artifactBranchesOf({
        row,
        plans,
        artifacts,
        mountIdsByAgentId: declared,
        agents,
        sessionMounts,
        projects,
      });
    const items = rows.map((row) => ({
      row,
      branches: branchesOf({ row, declared: mountIdsByAgentId }),
    }));
    const counted = isSettled
      ? items
      : rows.map((row) => ({ row, branches: branchesOf({ row, declared: NO_DECLARED }) }));
    const branchCount = namedBranchGroupCountOf({
      branchLists: counted
        .filter((item) => item.row.group !== 'deleted')
        .map((item) => item.branches),
      mounts,
    });
    return { items, mounts, branchCount };
  }, [
    rows,
    plans,
    artifacts,
    mountIdsByAgentId,
    isSettled,
    agents,
    sessionMounts,
    projects,
    mounts,
  ]);
};
