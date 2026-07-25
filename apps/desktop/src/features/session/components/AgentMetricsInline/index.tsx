import { cn } from '@goodboy/ui';
import type { TelemetryRecord } from '@goodboy/types';
import { getModelProvider } from '@goodboy/core';
import type { ProviderContextUsage } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import { CostBadge } from '../../../providers/components/CostBadge';
import { shortModelWithVersion } from '../../agent-row-format';
import { contextUsageTone } from '../../contextUsageTone';
import type { AgentAggregate } from '../AgentMetricsBlock';
import { contextUsageSummary } from './contextUsageSummary';

type Props = {
  readonly telemetry: TelemetryRecord | null;
  readonly aggregate: AgentAggregate | null;
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly plannedModel?: string | null;
  readonly muted?: boolean;
};

export const AgentMetricsInline = ({
  telemetry,
  aggregate,
  contextUsage,
  turns,
  turnsLoading,
  plannedModel = null,
  muted = false,
}: Props) => {
  const dominant = contextUsage[0] ?? null;
  const model = telemetry?.model ?? dominant?.model ?? plannedModel;
  const provider =
    telemetry?.provider ??
    dominant?.provider ??
    (plannedModel != null ? getModelProvider(plannedModel) : undefined);
  const summary = contextUsageSummary({ usage: contextUsage });
  const pct = summary == null ? null : Math.round(summary.pct * 100);

  return (
    <div
      data-testid="agent-metrics-inline"
      className={cn(
        'flex min-w-0 items-center gap-1.5 whitespace-nowrap text-2xs text-muted-foreground/80',
        muted && 'opacity-60',
      )}
    >
      <ProviderIcon provider={provider} muted={muted} variant="glyph" />
      {model != null ? (
        <span className="min-w-0 truncate" title={`model: ${model}`}>
          {shortModelWithVersion(model)}
        </span>
      ) : (
        <span className="text-muted-foreground/50">no model yet</span>
      )}
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      <CostBadge
        value={aggregate?.estimatedCostUsd ?? 0}
        title={
          aggregate == null ? 'no cost yet' : `$${aggregate.estimatedCostUsd.toFixed(4)} spent`
        }
      />
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      {summary == null || pct == null ? (
        <span className="tabular-nums text-muted-foreground/50" title="no context usage yet">
          ctx 0%
        </span>
      ) : (
        <span
          className={cn('tabular-nums', contextUsageTone({ pct: summary.pct, prefix: 'text' }))}
          title={`context: ${summary.usedTokens.toLocaleString()} / ${summary.windowTokens.toLocaleString()} tokens`}
        >
          ctx {pct}%
        </span>
      )}
      <span aria-hidden className="text-muted-foreground/40">
        ·
      </span>
      {turnsLoading ? (
        <span
          aria-label="loading turn count"
          className="inline-block h-2.5 w-4 motion-safe:animate-pulse rounded bg-muted"
        />
      ) : (
        <span className="tabular-nums" title={`${turns} turn${turns === 1 ? '' : 's'}`}>
          {turns}t
        </span>
      )}
    </div>
  );
};
