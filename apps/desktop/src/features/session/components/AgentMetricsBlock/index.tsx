import type { Agent, TelemetryRecord } from '@goodboy/types';
import { CostBadge } from '../../../providers/components/CostBadge';
import { formatTokens } from '../../agent-row-format';

export type AgentAggregate = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number;
  readonly turns: number;
};

type Props = {
  readonly run: Agent;
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly variant: 'workflow' | 'adhoc';
};

export function AgentMetricsBlock({
  run,
  telemetry,
  aggregate,
  turns,
  turnsLoading,
  variant,
}: Props) {
  void variant;
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap text-2xs text-muted-foreground/85">
      <span
        className="inline-flex items-baseline gap-0.5 tabular-nums"
        title={
          aggregate
            ? `in: ${aggregate.inputTokens.toLocaleString()} tokens (cumulative)`
            : 'no input tokens yet'
        }
      >
        <span aria-hidden className="text-muted-foreground/60">
          ↓
        </span>
        {aggregate ? formatTokens(aggregate.inputTokens) : '0'}
      </span>
      <span
        className="inline-flex items-baseline gap-0.5 tabular-nums"
        title={
          aggregate
            ? `out: ${aggregate.outputTokens.toLocaleString()} tokens (cumulative)`
            : 'no output tokens yet'
        }
      >
        <span aria-hidden className="text-muted-foreground/60">
          ↑
        </span>
        {aggregate ? formatTokens(aggregate.outputTokens) : '0'}
      </span>
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      {turnsLoading ? (
        <span
          aria-label="loading turn count"
          className="inline-block h-2.5 w-4 animate-pulse rounded bg-muted"
        />
      ) : (
        <span className="tabular-nums" title={`${turns} turn${turns === 1 ? '' : 's'}`}>
          {turns}t
        </span>
      )}
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <CostBadge
        value={aggregate?.estimatedCostUsd ?? 0}
        title={aggregate ? `$${aggregate.estimatedCostUsd.toFixed(4)} cumulative` : 'no cost yet'}
      />
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <AgentDuration run={run} />
    </div>
  );
}

function formatRelativeDuration(fromIso: string, toIso?: string): string {
  const fromMs = Date.parse(fromIso);
  if (Number.isNaN(fromMs)) return '';
  const toMs = toIso ? Date.parse(toIso) : Date.now();
  if (Number.isNaN(toMs)) return '';
  const diff = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function AgentDuration({ run }: { run: Agent }) {
  if (!run.startedAt) {
    return (
      <span className="font-mono text-muted-foreground/60" title="not started yet">
        ·
      </span>
    );
  }
  const ageStr = formatRelativeDuration(run.startedAt, run.completedAt);
  const tooltip = run.completedAt
    ? `started ${run.startedAt}\ncompleted ${run.completedAt}\nworked ${ageStr}`
    : `started ${run.startedAt}\nworking for ${ageStr}`;
  return (
    <span className="font-mono text-muted-foreground/80" title={tooltip}>
      {ageStr}
    </span>
  );
}
