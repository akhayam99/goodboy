import { useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { HOME_WIDGETS, type WidgetSize } from '../../grid/homeWidgets';
import { openBoard } from '../../openBoard';
import type { HomeFacts } from '../../hooks/useHomeFacts';
import { HeroNumber } from '../../WidgetCard/HeroNumber';
import { MoreLink } from '../../WidgetCard/MoreLink';
import { WidgetCard } from '../../WidgetCard';
import { WidgetSkeleton } from '../../WidgetCard/WidgetSkeleton';
import { rowsFor } from '../../WidgetCard/rowsFor';
import { RunningRow } from './RunningRow';
import { runningSinceOf } from './runningSinceOf';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
  readonly longIds: ReadonlySet<string>;
  readonly isLongShown: boolean;
};

const CLOCK_MS = 15_000;

export const RunningNow = ({ facts, size, longIds, isLongShown }: Props) => {
  const nowMs = useNow(CLOCK_MS);
  const shown = rowsFor({ size });
  const longest = useAppStore((state) => {
    const times = facts.running.flatMap((session) => {
      const since = runningSinceOf({ state, sessionId: session.id });
      return since === null ? [] : [since];
    });
    return times.length === 0 ? null : Math.min(...times);
  });
  const listed = isLongShown
    ? facts.running.filter((session) => !longIds.has(session.id))
    : facts.running;
  const hiddenLong = facts.running.length - listed.length;
  const extra = Math.max(0, listed.length - shown);
  const rows = useMemo(
    () =>
      listed
        .slice(0, shown)
        .map((session) => (
          <RunningRow
            key={session.id}
            session={session}
            nowMs={nowMs}
            isLong={longIds.has(session.id)}
          />
        )),
    [listed, longIds, nowMs, shown],
  );
  return (
    <WidgetCard
      id="runningNow"
      title={HOME_WIDGETS.runningNow.title}
      icon={CONCEPT_ICONS.runs}
      count={facts.isLoading ? 0 : facts.running.length}
      footer={extra > 0 ? <MoreLink count={extra} onOpen={openBoard} /> : undefined}
    >
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading running sessions" />
      ) : size === 'S' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <HeroNumber value={String(facts.running.length)} unit="running" />
          <span className="truncate text-meta text-faint-foreground tabular-nums">
            {longest === null
              ? ''
              : `Longest ${formatDuration({ durationMs: nowMs - longest }) ?? ''}`}
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
          {hiddenLong > 0 ? (
            <li className="text-meta text-faint-foreground">
              {hiddenLong} long running, shown in Long running
            </li>
          ) : null}
        </ul>
      )}
    </WidgetCard>
  );
};
