import type { FactCardSpec } from '@goodboy/ui';
import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import { clockSpanCardOf, latestFinishOf } from '../../../../timeline/clockSpan';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';

type ItemParams = {
  readonly item: TimelineRowItem;
};

export const isClocklessRow = ({ item }: ItemParams): boolean =>
  item.entry.kind === 'question' && item.entry.lane != null && item.grade === 'fact';

export const clockCardOf = ({ item }: ItemParams): FactCardSpec | null => {
  const { entry, at, rowState } = item;
  if (at === null) {
    return null;
  }
  if (entry.kind === 'agent') {
    return clockSpanCardOf({
      startedAt: entry.agent.startedAt ?? at,
      finishedAt: entry.agent.completedAt ?? entry.agent.lastFinishedAt ?? null,
      phase: rowState.phase,
    });
  }
  if (entry.kind === 'run') {
    return clockSpanCardOf({
      startedAt: at,
      finishedAt: latestFinishOf({
        entries: entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : [])),
      }),
      phase: rowState.phase,
    });
  }
  return null;
};

export const clockLabelOf = ({ item }: ItemParams): string =>
  item.at === null ? '' : `At ${formatClock({ at: item.at })}`;
