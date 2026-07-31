import { cn, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { Agent, ProviderId, TelemetryRecord } from '@goodboy/types';
import { getModelProvider } from '@goodboy/core';
import type { ProviderContextUsage } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import { CostBadge } from '../../../providers/components/CostBadge';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { contextUsageTone } from '../../contextUsageTone';
import { formatTokens } from '../../agent-row-format';
import { AgentDuration } from './AgentDuration';
import { contextUsageSummary } from './contextUsageSummary';

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
  readonly contextUsage: ReadonlyArray<ProviderContextUsage>;
  readonly turns: number;
  readonly turnsLoading: boolean;
  readonly density: 'compact' | 'full';
  readonly plannedModel?: string | null;
  readonly plannedProvider?: ProviderId | null;
  readonly muted?: boolean;
};

export const AgentMetrics = ({
  run,
  telemetry,
  aggregate,
  contextUsage,
  turns,
  turnsLoading,
  density,
  plannedModel = null,
  plannedProvider = null,
  muted = false,
}: Props) => {
  const dominant = contextUsage[0] ?? null;
  const model = telemetry?.model ?? dominant?.model ?? plannedModel;
  const provider =
    telemetry?.provider ??
    dominant?.provider ??
    plannedProvider ??
    (plannedModel != null ? getModelProvider(plannedModel) : undefined);
  const summary = contextUsageSummary({ usage: contextUsage });
  const pct = summary == null ? null : Math.round(summary.pct * 100);
  const inputTokens = aggregate?.inputTokens ?? 0;
  const outputTokens = aggregate?.outputTokens ?? 0;
  const showTokens =
    density === 'full' && (inputTokens > 0 || outputTokens > 0 || run.startedAt != null);

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div
        data-testid="agent-metrics-inline"
        className={cn(
          'flex min-w-0 items-center gap-1.5 whitespace-nowrap text-2xs text-muted-foreground/80',
          muted && 'opacity-60',
        )}
      >
        <RoutingBadge
          provider={provider ?? null}
          model={model ?? null}
          muted={muted}
          missingLabel="no model yet"
        />
        <span aria-hidden className="text-muted-foreground/40">
          ·
        </span>
        <CostBadge
          value={aggregate?.estimatedCostUsd ?? 0}
          title={
            aggregate == null
              ? 'no cost yet'
              : `${formatUsdPrecise(aggregate.estimatedCostUsd)} spent`
          }
        />
        {summary != null && pct != null ? (
          <>
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <span
              className={cn('tabular-nums', contextUsageTone({ pct: summary.pct, prefix: 'text' }))}
              title={`context: ${summary.usedTokens.toLocaleString()} / ${summary.windowTokens.toLocaleString()} tokens`}
            >
              ctx {pct}%
            </span>
          </>
        ) : null}
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
      {showTokens ? (
        <div
          data-testid="agent-metrics-block"
          className="flex items-center gap-1.5 whitespace-nowrap text-2xs text-muted-foreground/55"
        >
          <span
            className="inline-flex items-baseline gap-0.5 tabular-nums"
            title={`in: ${inputTokens.toLocaleString()} tokens (cumulative)`}
          >
            <span aria-hidden className="text-muted-foreground/40">
              ↓
            </span>
            {formatTokens(inputTokens)}
          </span>
          <span
            className="inline-flex items-baseline gap-0.5 tabular-nums"
            title={`out: ${outputTokens.toLocaleString()} tokens (cumulative)`}
          >
            <span aria-hidden className="text-muted-foreground/40">
              ↑
            </span>
            {formatTokens(outputTokens)}
          </span>
          <span aria-hidden className="text-muted-foreground/30">
            ·
          </span>
          <AgentDuration run={run} />
        </div>
      ) : null}
    </div>
  );
};
