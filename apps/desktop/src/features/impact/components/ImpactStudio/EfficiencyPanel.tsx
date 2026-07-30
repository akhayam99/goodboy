import type {
  CacheEfficiencyEntry,
  ContextGrowthPoint,
  NudgeOutcomeCount,
  TurnBucket,
} from '@goodboy/db';
import { StatCard, formatTokens } from '@goodboy/ui';
import { ArrowUpRight, Wallet } from 'lucide-react';
import type { QueryResult } from '../../hooks/useImpactMetrics';
import { turnStats } from '../../utils/turnStats';
import { ErrorStrip } from './ErrorStrip';
import { PanelLoading } from './PanelLoading';
import { PanelShell } from './PanelShell';
import { Sparkline } from './Sparkline';
import { TurnHistogram } from './TurnHistogram';
import { Widget } from './Widget';

type Props = {
  readonly cacheEfficiency: QueryResult<ReadonlyArray<CacheEfficiencyEntry>>;
  readonly contextGrowth: QueryResult<ReadonlyArray<ContextGrowthPoint>>;
  readonly turns: QueryResult<ReadonlyArray<TurnBucket>>;
  readonly nudges: QueryResult<ReadonlyArray<NudgeOutcomeCount>>;
  readonly isLoading: boolean;
  readonly onRetry: () => void;
};

export const EfficiencyPanel = ({
  cacheEfficiency,
  contextGrowth,
  turns,
  nudges,
  isLoading,
  onRetry,
}: Props) => {
  const cache = cacheEfficiency.data;
  const context = contextGrowth.data;
  const turnData = turns.data;
  const nudgeData = nudges.data;
  const stats = turnData === null ? null : turnStats({ buckets: turnData });
  const totalInput = cache?.reduce((sum, entry) => sum + entry.inputTokens, 0) ?? 0;
  const totalCached = cache?.reduce((sum, entry) => sum + entry.cachedInputTokens, 0) ?? 0;
  const overallHitRatio = totalInput > 0 ? totalCached / totalInput : 0;
  const accepted = nudgeData?.find((entry) => entry.outcome === 'accepted')?.count ?? 0;
  const nudgeTotal = nudgeData?.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
  return (
    <PanelShell title="Efficiency" subtitle="Token reuse, context growth, and right-sized runs">
      <ErrorStrip label="cache efficiency" error={cacheEfficiency.error} onRetry={onRetry} />
      <ErrorStrip label="context growth" error={contextGrowth.error} onRetry={onRetry} />
      <ErrorStrip label="turn distribution" error={turns.error} onRetry={onRetry} />
      <ErrorStrip label="right-size nudges" error={nudges.error} onRetry={onRetry} />
      {isLoading &&
      cache === null &&
      context === null &&
      turnData === null &&
      nudgeData === null ? (
        <PanelLoading />
      ) : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="cache hit ratio" value={`${Math.round(overallHitRatio * 100)}%`} />
        <StatCard label="cached input" value={formatTokens(totalCached)} />
        <StatCard
          label="turns / agent"
          value={stats === null ? 'n/a' : String(stats.median)}
          hint={stats === null ? undefined : `p90 ${stats.p90}`}
        />
        <StatCard
          label="right-size accepted"
          value={nudgeTotal > 0 ? `${Math.round((accepted / nudgeTotal) * 100)}%` : 'n/a'}
          hint={`${nudgeTotal} nudges`}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Widget label="cache reuse by provider" hint="cached input divided by input tokens">
          <div className="flex flex-col gap-2">
            {cache?.map((entry) => (
              <div key={entry.provider} className="flex flex-col gap-1">
                <div className="flex items-center gap-3 text-xs">
                  <span className="min-w-0 flex-1 capitalize">{entry.provider}</span>
                  <span className="font-mono tabular-nums">
                    {Math.round(entry.hitRatio * 100)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${entry.hitRatio * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Widget>
        <Widget label="context growth per turn" hint="latest 40 measured turns">
          <Sparkline values={context?.map((point) => point.contextTokens) ?? []} />
        </Widget>
        <Widget label="turn distribution" hint={`${stats?.agents ?? 0} agents`}>
          {stats !== null && turnData !== null ? (
            <TurnHistogram buckets={turnData} median={stats.median} maxAgents={stats.maxAgents} />
          ) : (
            <span className="text-xs text-muted-foreground">No turns in this window.</span>
          )}
        </Widget>
        <Widget label="right-size nudges" hint="outcomes after a routing suggestion">
          <div className="flex flex-col gap-1">
            {nudgeData?.map((entry) => (
              <div key={entry.outcome ?? 'pending'} className="flex items-center gap-3 text-xs">
                <span className="min-w-0 flex-1 capitalize">{entry.outcome ?? 'pending'}</span>
                <span className="font-mono tabular-nums">{entry.count}</span>
              </div>
            ))}
          </div>
        </Widget>
      </div>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-budget-studio'))}
        className="flex items-center gap-3 rounded-lg border border-border-soft bg-muted/10 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <Wallet size={16} aria-hidden className="text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Spend and caps live in Budget</span>
          <span className="block text-2xs text-muted-foreground">
            Open Budget Studio for cost, provider mix, caps, and alerts.
          </span>
        </span>
        <ArrowUpRight size={14} aria-hidden className="text-muted-foreground" />
      </button>
    </PanelShell>
  );
};
