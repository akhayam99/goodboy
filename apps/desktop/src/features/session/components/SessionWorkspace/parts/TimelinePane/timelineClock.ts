import type { TimelineRowItem } from '../../../../timeline/buildTimelineStream';

export const CLOCK_ORDER_TOOLTIP =
  'Newest first. Each row is stamped with its own moment: agent start, answer time or record time.';

export const isClocklessRow = ({ item }: { readonly item: TimelineRowItem }): boolean =>
  item.entry.kind === 'question' && item.entry.lane != null && item.grade === 'fact';
