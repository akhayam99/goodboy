import type { AgentId, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { Check, Clock, Layers, Loader2 } from 'lucide-react';
import { MARKER_ACCENT } from '../marker-accents';
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

const statusIcon = (status: ClusterDashboardItem['agent']['status']) =>
  status === 'running' ? (
    <Loader2 size={14} className="animate-spin text-info" aria-hidden />
  ) : status === 'completed' ? (
    <span className="flex size-4 items-center justify-center rounded-full bg-success/15">
      <Check size={10} className="text-success" aria-hidden />
    </span>
  ) : status === 'failed' ? (
    <span className="size-2 rounded-full bg-danger" aria-hidden />
  ) : (
    <Clock size={14} className="text-muted-foreground/60" aria-hidden />
  );

const statusLabel = (status: ClusterDashboardItem['agent']['status']): string =>
  status === 'running'
    ? 'running…'
    : status === 'completed'
      ? 'done'
      : status === 'failed'
        ? 'stalled'
        : 'queued';

export const ClusterProgressDashboard = ({
  sessionId,
  items,
  completed,
  total,
  selectedAgentId,
  onSelect,
}: Props) => (
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
    {items.map(({ agent, index, instructions }) => {
      const isSelected = agent.id === selectedAgentId;
      const body =
        agent.status === 'completed' ? (agent.outputSummary ?? instructions) : instructions;
      return (
        <button
          key={agent.id}
          type="button"
          onClick={() => onSelect(agent.id)}
          className={cn(
            'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
            isSelected
              ? cn(accent.border, accent.bg)
              : 'border-border hover:border-merged/40 hover:bg-merged/5',
          )}
        >
          <span className="mt-0.5 shrink-0 tabular-nums text-xs text-muted-foreground/60">
            {index + 1}/{total}
          </span>
          <span className="mt-0.5 shrink-0">{statusIcon(agent.status)}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium text-foreground">
                {agent.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground/70">
                {statusLabel(agent.status)}
              </span>
            </span>
            {body ? (
              <span className="line-clamp-2 text-xs text-muted-foreground">{body}</span>
            ) : null}
          </span>
        </button>
      );
    })}
  </div>
);
