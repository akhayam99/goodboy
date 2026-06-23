import type { AgentId, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { Layers } from 'lucide-react';
import { MARKER_ACCENT } from '../marker-accents';
import { SpawnedAgentList, type SpawnedAgentItem } from '../SpawnedAgentList';
import type { ClusterDashboardItem } from './clusterDashboard';

type Props = {
  readonly sessionId: SessionId;
  readonly items: ReadonlyArray<ClusterDashboardItem>;
  readonly completed: number;
  readonly total: number;
  readonly selectedAgentId: AgentId | undefined;
  readonly onSelect: (agentId: AgentId) => void;
};

const accent = MARKER_ACCENT.clusters;

export const ClusterProgressDashboard = ({
  sessionId,
  items,
  completed,
  total,
  selectedAgentId,
  onSelect,
}: Props) => {
  const listItems: ReadonlyArray<SpawnedAgentItem> = items.map(
    ({ agent, index, instructions }) => ({
      key: agent.id,
      index,
      total,
      name: agent.name,
      body: agent.status === 'completed' ? (agent.outputSummary ?? instructions) : instructions,
      status: agent.status,
      agentId: agent.id,
    }),
  );
  return (
    <div
      className="mx-auto flex w-full max-w-[640px] flex-col gap-3 py-10"
      data-session-id={sessionId}
      data-testid="cluster-progress-dashboard"
    >
      <div className={cn('flex items-center gap-1.5 text-sm font-medium', accent.text)}>
        <Layers size={14} aria-hidden />
        <span>
          cluster progress {completed}/{total}
        </span>
      </div>
      <SpawnedAgentList
        items={listItems}
        selectedAgentId={selectedAgentId}
        onSelect={onSelect}
        variant="dashboard"
      />
    </div>
  );
};
