import type { AgentId, AgentStatus, ProviderRunId } from '@goodboy/types';
import { SpawnTree } from '../../../orchestration/components/SpawnTree';
import {
  statusToNodeStatus,
  type SpawnNode,
} from '../../../orchestration/components/SpawnTree/lib';

type Props = {
  parallelRunIds: ReadonlyArray<ProviderRunId>;
  runStatuses: Readonly<Record<ProviderRunId, AgentStatus>>;
  onSelectRun: (runId: ProviderRunId) => void;
};

export const ParallelProgressPill = ({ parallelRunIds, runStatuses, onSelectRun }: Props) => {
  if (parallelRunIds.length === 0) {
    return null;
  }

  const nodes: ReadonlyArray<SpawnNode> = parallelRunIds.map((runId, i) => ({
    id: runId as unknown as AgentId,
    name: `p${i + 1}`,
    kind: 'generic',
    status: statusToNodeStatus(runStatuses[runId] ?? 'pending'),
    costUsd: 0,
    outputSummary: null,
    children: [],
    isSelected: false,
  }));

  return (
    <SpawnTree
      variant="rail"
      nodes={nodes}
      onSelect={(id) => onSelectRun(id as unknown as ProviderRunId)}
    />
  );
};
