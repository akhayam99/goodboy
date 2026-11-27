import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { useNow } from '../../../../shared/hooks/useNow';
import { HOME_WIDGETS, type WidgetSize } from '../../grid/homeWidgets';
import type { HomeFacts } from '../../hooks/useHomeFacts';
import { useMergedWeek } from '../../hooks/useMergedWeek';
import { openBoard } from '../../openBoard';
import { openSessionPlace } from '../../openSessionPlace';
import { HeroNumber } from '../../WidgetCard/HeroNumber';
import { MoreLink } from '../../WidgetCard/MoreLink';
import { WidgetCard } from '../../WidgetCard';
import { WidgetRow } from '../../WidgetCard/WidgetRow';
import { WidgetSkeleton } from '../../WidgetCard/WidgetSkeleton';
import { rowsFor } from '../../WidgetCard/rowsFor';
import { DayBars } from './DayBars';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
};

const CLOCK_MS = 60_000;

export const MergedThisWeek = ({ facts, size }: Props) => {
  const week = useMergedWeek();
  const nowMs = useNow(CLOCK_MS);
  const shown = rowsFor({ size });
  const extra = Math.max(0, week.rows.length - shown);
  const bars = <DayBars byDay={week.byDay} label="Merged each day this week" />;
  return (
    <WidgetCard
      id="mergedThisWeek"
      title={HOME_WIDGETS.mergedThisWeek.title}
      icon={CONCEPT_ICONS.merge}
      count={facts.isLoading ? 0 : week.rows.length}
      footer={extra > 0 ? <MoreLink count={extra} onOpen={openBoard} /> : undefined}
    >
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading merged pull requests" />
      ) : size === 'S' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <HeroNumber value={String(week.rows.length)} unit="merged" />
          {bars}
        </div>
      ) : (
        <>
          {bars}
          <ul
            className={
              size === 'L'
                ? 'grid min-w-0 flex-1 grid-cols-2 content-start gap-x-4'
                : 'flex min-w-0 flex-1 flex-col'
            }
          >
            {week.rows.slice(0, shown).map((row) => (
              <WidgetRow
                key={row.key}
                lead={null}
                title={row.title === '' ? 'Merged pull request' : row.title}
                meta={formatSpan({ from: row.mergedAtMs, to: nowMs })}
                label={`Open ${row.title}, merged`}
                onOpen={() => openSessionPlace({ sessionId: row.sessionId })}
              />
            ))}
          </ul>
        </>
      )}
    </WidgetCard>
  );
};
