import { Sparkline, formatUsd } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { HOME_WIDGETS, type WidgetSize } from '../../grid/homeWidgets';
import { useDailySpend } from '../../hooks/useDailySpend';
import type { HomeFacts } from '../../hooks/useHomeFacts';
import { EmptyLine } from '../../WidgetCard/EmptyLine';
import { HeroNumber } from '../../WidgetCard/HeroNumber';
import { WidgetCard } from '../../WidgetCard';
import { WidgetSkeleton } from '../../WidgetCard/WidgetSkeleton';
import { SpenderRow } from './SpenderRow';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
};

const SPENDERS_BY_SIZE = { S: 0, M: 2, L: 5 } as const satisfies Record<WidgetSize, number>;

type DeltaParams = {
  readonly todayUsd: number;
  readonly yesterdayUsd: number;
};

const deltaText = ({ todayUsd, yesterdayUsd }: DeltaParams): string => {
  const delta = todayUsd - yesterdayUsd;
  if (Math.abs(delta) < 0.005) {
    return 'Same as yesterday';
  }
  return `${delta > 0 ? '+' : '-'}${formatUsd(Math.abs(delta))} vs yesterday`;
};

export const Spend = ({ facts, size }: Props) => {
  const spend = useDailySpend();
  const spenders = spend.spenders.slice(0, SPENDERS_BY_SIZE[size]);
  const topUsd = spend.spenders[0]?.usd ?? 0;
  const today = <HeroNumber value={formatUsd(spend.todayUsd)} unit="today" />;
  return (
    <WidgetCard id="spend" title={HOME_WIDGETS.spend.title} icon={CONCEPT_ICONS.budget}>
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading spend" />
      ) : spend.weekUsd === 0 ? (
        <EmptyLine text="No spend yet. It fills as agents run." />
      ) : size === 'S' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          {today}
          <span className="truncate text-meta text-faint-foreground tabular-nums">
            {deltaText({ todayUsd: spend.todayUsd, yesterdayUsd: spend.yesterdayUsd })}
          </span>
        </div>
      ) : (
        <div
          className={
            size === 'L'
              ? 'grid min-h-0 min-w-0 flex-1 grid-cols-2 gap-4'
              : 'flex min-h-0 min-w-0 flex-1 flex-col gap-2'
          }
        >
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              {today}
              <HeroNumber value={formatUsd(spend.weekUsd)} unit="this week" />
            </div>
            <Sparkline values={spend.daily} formatMaximum={formatUsd} />
          </div>
          <ul aria-label="Top spenders this week" className="flex min-w-0 flex-col gap-2">
            {spenders.map((spender) => (
              <SpenderRow key={spender.sessionId} spender={spender} topUsd={topUsd} />
            ))}
          </ul>
        </div>
      )}
    </WidgetCard>
  );
};
