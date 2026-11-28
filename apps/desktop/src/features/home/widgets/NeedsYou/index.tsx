import { useAppStore } from '../../../../store';
import { cachedStageInfoOf } from '../../../../store/slices/session-view/cachedStageInfoOf';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { HOME_WIDGETS, type WidgetSize } from '../../grid/homeWidgets';
import { openBoard } from '../../openBoard';
import type { HomeFacts } from '../../hooks/useHomeFacts';
import { HeroNumber } from '../../WidgetCard/HeroNumber';
import { MoreLink } from '../../WidgetCard/MoreLink';
import { WidgetCard } from '../../WidgetCard';
import { WidgetSkeleton } from '../../WidgetCard/WidgetSkeleton';
import { rowsFor } from '../../WidgetCard/rowsFor';
import { NeedsYouRow } from './NeedsYouRow';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
};

const CLOCK_MS = 30_000;

export const NeedsYou = ({ facts, size }: Props) => {
  const nowMs = useNow(CLOCK_MS);
  const sessions = facts.needsYou;
  const shown = rowsFor({ size });
  const oldest = useAppStore((state) => {
    const times = sessions.flatMap((session) => {
      const since = cachedStageInfoOf({ state, session }).attentionSince;
      return since == null ? [] : [since];
    });
    return times.length === 0 ? null : Math.min(...times);
  });
  const extra = Math.max(0, sessions.length - shown);
  const rows = sessions
    .slice(0, shown)
    .map((session, index) => (
      <NeedsYouRow key={session.id} session={session} nowMs={nowMs} isFirst={index === 0} />
    ));
  return (
    <WidgetCard
      id="needsYou"
      title={HOME_WIDGETS.needsYou.title}
      icon={CONCEPT_ICONS.needsYou}
      count={facts.isLoading ? 0 : facts.counts.needsYou}
      tone="warning"
      isWarm
      footer={extra > 0 ? <MoreLink count={extra} onOpen={openBoard} /> : undefined}
    >
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading what needs you" />
      ) : size === 'S' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <HeroNumber value={String(facts.counts.needsYou)} unit="need you" />
          <span className="truncate text-meta text-faint-foreground tabular-nums">
            {oldest === null ? '' : `Oldest waiting ${formatSpan({ from: oldest, to: nowMs })}`}
          </span>
        </div>
      ) : (
        <ul
          className={
            size === 'L'
              ? 'grid min-w-0 flex-1 grid-cols-2 content-start gap-x-4'
              : 'flex min-w-0 flex-1 flex-col'
          }
        >
          {rows}
        </ul>
      )}
    </WidgetCard>
  );
};
