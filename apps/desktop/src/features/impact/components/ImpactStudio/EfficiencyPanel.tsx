import type {
  CacheEfficiencyEntry,
  ContextGrowthPoint,
  NudgeOutcomeCount,
  TurnBucket,
} from '@goodboy/db';
import { EmptyState, StatCard, formatTokens } from '@goodboy/ui';
import { ErrorStrip } from '@goodboy/ui';
import { PanelLoading } from '@goodboy/ui';
import type { QueryResult } from '../../../../shared/types/queryResult';
import { turnStats } from '../../utils/turnStats';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { TurnHistogram } from './TurnHistogram';
import { StudioWidget } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { Sparkline } from '@goodboy/ui';
import { formatInteger } from '../../../../shared/utils/formatInteger';

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
    <StudioPanel title="Efficiency" subtitle="Token reuse, context growth, and right-sized runs">
      <ErrorStrip label="cache efficiency" error={cacheEfficiency.error} onRetry={onRetry} />
      <ErrorStrip label="context growth" error={contextGrowth.error} onRetry={onRetry} />
      <ErrorStrip label="turn distribution" error={turns.error} onRetry={onRetry} />
      <ErrorStrip label="right-size nudges" error={nudges.error} onRetry={onRetry} />
      {isLoading &&
      cache === null &&
      context === null &&
      turnData === null &&
      nudgeData === null ? (
        <PanelLoading label="Loading impact metrics" />
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
        <StudioWidget label="cache reuse by provider" hint="cached input divided by input tokens">
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
        </StudioWidget>
        <StudioWidget label="context growth per turn" hint="latest 40 measured turns">
          <Sparkline
            values={context?.map((point) => point.contextTokens) ?? []}
            formatMaximum={(maximum) => `${formatInteger(maximum)} tokens`}
          />
        </StudioWidget>
        <StudioWidget label="turn distribution" hint={`${stats?.agents ?? 0} agents`}>
          {stats !== null && turnData !== null ? (
            <TurnHistogram buckets={turnData} median={stats.median} maxAgents={stats.maxAgents} />
          ) : (
            <EmptyState
              icon={CONCEPT_ICONS.impact}
              tone={CONCEPT_TONE.impact}
              title="No turns in this window"
              size="inline"
            />
          )}
        </StudioWidget>
        <StudioWidget label="right-size nudges" hint="outcomes after a routing suggestion">
          <div className="flex flex-col gap-1">
            {nudgeData?.map((entry) => (
              <div key={entry.outcome ?? 'pending'} className="flex items-center gap-3 text-xs">
                <span className="min-w-0 flex-1 capitalize">{entry.outcome ?? 'pending'}</span>
                <span className="font-mono tabular-nums">{entry.count}</span>
              </div>
            ))}
          </div>
        </StudioWidget>
      </div>
    </StudioPanel>
  );
};
