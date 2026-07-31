import type { AgentId, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { ChevronRight, Layers } from 'lucide-react';
import { useState } from 'react';
import { tintClasses } from '@goodboy/ui';
import { SpawnedAgentList, type SpawnedAgentItem } from '../SpawnedAgentList';
import { clusterBody } from '../SpawnedAgentList/clusterBody';
import type { ClusterDashboardItem } from './clusterDashboard';

type Props = {
  readonly sessionId: SessionId;
  readonly items: ReadonlyArray<ClusterDashboardItem>;
  readonly completed: number;
  readonly total: number;
  readonly selectedAgentId: AgentId | undefined;
  readonly onSelect: (agentId: AgentId) => void;
  readonly onAdvance: (childAgentId: AgentId) => void;
};

const accent = tintClasses('merged');

export const ClusterProgressDashboard = ({
  sessionId,
  items,
  completed,
  total,
  selectedAgentId,
  onSelect,
  onAdvance,
}: Props) => {
  const [confirming, setConfirming] = useState(false);
  const current = items.find((item) => item.agent.status !== 'completed');
  const listItems: ReadonlyArray<SpawnedAgentItem> = items.map(
    ({ agent, index, instructions }) => ({
      key: agent.id,
      index,
      total,
      name: agent.name,
      body: clusterBody({ agent, instructions }),
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
        <span className="tabular-nums">
          cluster progress {completed}/{total}
        </span>
      </div>
      <SpawnedAgentList
        items={listItems}
        selectedAgentId={selectedAgentId}
        onSelect={onSelect}
        variant="dashboard"
      />
      {current ? (
        <button
          type="button"
          data-testid="cluster-advance-button"
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            setConfirming(false);
            onAdvance(current.agent.id);
          }}
          onBlur={() => setConfirming(false)}
          className={cn(
            'mt-1 flex items-center justify-center gap-1.5 self-end rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            confirming
              ? cn(accent.border, accent.bg, accent.text)
              : cn('border-border text-muted-foreground', accent.hoverBorder, accent.hoverBgSoft),
          )}
        >
          {confirming ? 'advance without marker?' : 'advance to next cluster'}
          <ChevronRight size={13} aria-hidden />
        </button>
      ) : null}
    </div>
  );
};
