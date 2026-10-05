import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import { clockSpanText, latestFinishOf } from '../../../../timeline/clockSpan';
import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';

export const isClocklessRow = ({ item }: { readonly item: TimelineRowItem }): boolean =>
  item.entry.kind === 'question' && item.entry.lane != null && item.grade === 'fact';

export const clockTooltipOf = ({ item }: { readonly item: TimelineRowItem }): string => {
  const { entry, at, rowState } = item;
  if (at === null) {
    return '';
  }
  if (entry.kind === 'agent') {
    return clockSpanText({
      startedAt: entry.agent.startedAt ?? at,
      finishedAt: entry.agent.completedAt ?? entry.agent.lastFinishedAt ?? null,
      phase: rowState.phase,
    });
  }
  if (entry.kind === 'run') {
    return clockSpanText({
      startedAt: at,
      finishedAt: latestFinishOf({
        entries: entry.children.flatMap((child) => (child.kind === 'agent' ? [child] : [])),
      }),
      phase: rowState.phase,
    });
  }
  return `At ${formatClock({ at })}`;
};
