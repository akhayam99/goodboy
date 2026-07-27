import type { ModelMixEntry, NudgeOutcomeCount, TurnBucket } from '@goodboy/db';
import { Chip, formatUsd, SectionHeader, Skeleton, StatusDot } from '@goodboy/ui';
import type { ImpactWindowId } from '../../lib';
import { formatShare } from '../../utils/formatShare';
import { sharePercent } from '../../utils/sharePercent';
import { tierMix } from '../../utils/tierMix';
import { turnStats } from '../../utils/turnStats';
import { MetricCard } from './MetricCard';
import { MetricRow } from './MetricRow';
import { StackedBar } from './StackedBar';
import { TurnHistogram } from './TurnHistogram';
import { WindowEmptyState } from './WindowEmptyState';

type Props = {
  readonly turns: ReadonlyArray<TurnBucket> | null;
  readonly mix: ReadonlyArray<ModelMixEntry> | null;
  readonly nudges: ReadonlyArray<NudgeOutcomeCount> | null;
  readonly windowId: ImpactWindowId;
};

const TURNS_COACHING =
  'Many turns per agent means the agent is looping, or the instructions are unclear. Tighten the goal, or consume a plan first.';
const TIER_COACHING =
  'Most spend runs on your largest models. Route scouting and summaries to a smaller tier, and keep the big model for hard steps.';
const UPKEEP_COACHING =
  'Over a fifth of spend goes to re-summarizing. Long sessions re-summarize often, so split big goals into shorter sessions.';
const NUDGE_COACHING =
  'You usually keep the original model when nudged. Accepting the suggested size is the cheapest saving here.';

const MIN_SPEND_USD = 1;

export const EffortSection = ({ turns, mix, nudges, windowId }: Props) => {
  const stats = turns === null ? null : turnStats({ buckets: turns });
  const tiers = mix === null ? null : tierMix({ entries: mix });
  const accepted = nudges?.find((entry) => entry.outcome === 'accepted')?.count ?? 0;
  const overridden = nudges?.find((entry) => entry.outcome === 'overridden')?.count ?? 0;
  const dismissed = nudges?.find((entry) => entry.outcome === 'dismissed')?.count ?? 0;
  const decided = accepted + overridden + dismissed;
  const shown = nudges?.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
  const acceptedShare = sharePercent({ part: accepted, total: decided });

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        label="Right-sized effort"
        hint="Whether each step ran on the smallest model and the fewest turns that could do it"
      />
      {turns === null ? (
        <Skeleton className="h-32 rounded-lg" />
      ) : stats === null && windowId === 'last30' ? (
        <WindowEmptyState what="agent turns" />
      ) : stats === null ? (
        <MetricRow
          label="turns per agent"
          measure="Turns recorded against each agent's provider run, bucketed across every agent"
          value="No turns yet"
        />
      ) : (
        <MetricCard
          label="turns per agent"
          measure="Turns recorded against each agent's provider run, bucketed across every agent"
          value={`${stats.median} median`}
          hint={`${stats.p90} at p90, across ${stats.agents} agents`}
          coaching={
            stats.agents >= 10 && (stats.median > 6 || stats.p90 > 12) ? TURNS_COACHING : null
          }
        >
          <TurnHistogram buckets={turns} median={stats.median} maxAgents={stats.maxAgents} />
        </MetricCard>
      )}
      {tiers === null ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : tiers.totalCostUsd === 0 && windowId === 'last30' ? (
        <WindowEmptyState what="model spend" />
      ) : (
        <MetricRow
          label="model mix by tier"
          measure="Share of spend per model cost tier, taken from the model registry"
          value={
            tiers.totalCostUsd > 0 ? `${Math.round(tiers.topTierShare)}% largest` : 'No spend yet'
          }
          hint={tiers.slices.length > 0 ? undefined : 'No telemetry recorded yet'}
          coaching={
            tiers.totalCostUsd >= MIN_SPEND_USD && tiers.topTierShare > 70 ? TIER_COACHING : null
          }
        >
          <StackedBar
            segments={tiers.slices.map((slice) => ({
              key: slice.tier,
              tone: slice.tone,
              share: slice.share,
              title: `${slice.label}: ${formatUsd(slice.costUsd)}`,
            }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            {tiers.slices.map((slice) => (
              <Chip
                key={slice.tier}
                tone={slice.tone}
                size="sm"
                label={`${slice.label} ${formatUsd(slice.costUsd)}`}
              />
            ))}
          </div>
        </MetricRow>
      )}
      {tiers === null ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : (
        <MetricRow
          label="context upkeep share"
          measure="Share of spend recorded as summarizer work rather than agent turns"
          value={tiers.totalCostUsd > 0 ? `${Math.round(tiers.upkeepShare)}%` : 'No spend yet'}
          hint={`${formatUsd(tiers.totalCostUsd)} total spend in this window`}
          leading={
            <StatusDot
              tone={
                tiers.totalCostUsd === 0
                  ? 'neutral'
                  : tiers.upkeepShare > 20
                    ? 'warning'
                    : 'success'
              }
            />
          }
          coaching={
            tiers.totalCostUsd >= MIN_SPEND_USD && tiers.upkeepShare > 20 ? UPKEEP_COACHING : null
          }
        />
      )}
      {nudges === null ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : (
        <MetricRow
          label="right-size nudges accepted"
          measure="Model suggestions you accepted, over the suggestions you acted on"
          value={
            shown === 0
              ? 'No model suggestions yet'
              : formatShare({ part: accepted, total: decided })
          }
          hint={
            shown === 0
              ? undefined
              : `${accepted} accepted, ${overridden} kept the original, ${dismissed} dismissed`
          }
          leading={
            <StatusDot
              tone={acceptedShare == null ? 'neutral' : acceptedShare >= 25 ? 'success' : 'warning'}
            />
          }
          coaching={
            shown >= 8 && acceptedShare != null && acceptedShare < 25 ? NUDGE_COACHING : null
          }
        />
      )}
    </section>
  );
};
