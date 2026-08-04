import { MetaRow, cn, formatUsdPrecise } from '@goodboy/ui';
import type { Agent, ProviderId, TelemetryRecord } from '@goodboy/types';
import { getModelProvider } from '@goodboy/core';
import type { ProviderContextUsage } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import { CostBadge } from '../../../providers/components/CostBadge';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
import { AgentLastUpdate } from '../../../../shared/components/AgentLastUpdate';
import { contextUsageTone } from '../../contextUsageTone';
import { formatTokens } from '../../agent-row-format';
import { formatInteger } from '../../../../shared/utils/formatInteger';
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
  readonly density: 'compact' | 'full' | 'lane';
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
  const isLane = density === 'lane';
  const showTokens =
    density === 'full' && (inputTokens > 0 || outputTokens > 0 || run.startedAt != null);

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div data-testid="agent-metrics-inline" className={cn('flex min-w-0', muted && 'opacity-60')}>
        <MetaRow
          className={cn(
            'min-w-0 text-muted-foreground/80',
            !isLane && 'flex-nowrap whitespace-nowrap',
          )}
          items={[
            <RoutingBadge
              key="model"
              provider={provider ?? null}
              model={model ?? null}
              muted={muted}
              missingLabel="no model yet"
            />,
            <CostBadge
              key="cost"
              value={aggregate?.estimatedCostUsd ?? 0}
              title={
                aggregate == null
                  ? 'no cost yet'
                  : `${formatUsdPrecise(aggregate.estimatedCostUsd)} spent`
              }
            />,
            summary != null && pct != null ? (
              <span
                key="context"
                className={cn(
                  'tabular-nums',
                  contextUsageTone({ pct: summary.pct, prefix: 'text' }),
                )}
                title={`Context: ${formatInteger(summary.usedTokens)} / ${formatInteger(summary.windowTokens)} tokens`}
              >
                ctx {pct}%
              </span>
            ) : null,
            turnsLoading ? (
              <span
                key="turns"
                aria-label="Loading turn count"
                className="inline-block h-2.5 w-4 motion-safe:animate-pulse rounded bg-muted"
              />
            ) : (
              <span
                key="turns"
                className="tabular-nums"
                title={`${turns} turn${turns === 1 ? '' : 's'}`}
              >
                {turns}t
              </span>
            ),
            isLane && run.startedAt != null ? <AgentDuration key="duration" run={run} /> : null,
            isLane ? <AgentLastUpdate key="updated" agent={run} /> : null,
          ]}
        />
      </div>
      {showTokens ? (
        <div
          data-testid="agent-metrics-block"
          className="flex items-center gap-1.5 whitespace-nowrap text-2xs text-muted-foreground/55"
        >
          <span
            className="inline-flex items-baseline gap-0.5 tabular-nums"
            title={`In: ${formatInteger(inputTokens)} tokens (cumulative)`}
          >
            <span aria-hidden className="text-muted-foreground/70">
              ↓
            </span>
            {formatTokens(inputTokens)}
          </span>
          <span
            className="inline-flex items-baseline gap-0.5 tabular-nums"
            title={`Out: ${formatInteger(outputTokens)} tokens (cumulative)`}
          >
            <span aria-hidden className="text-muted-foreground/70">
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
