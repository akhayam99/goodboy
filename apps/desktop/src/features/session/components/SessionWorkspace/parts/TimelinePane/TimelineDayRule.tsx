import { Divider, cn } from '@goodboy/ui';
import type { TimelineDayItem } from '../../../../timeline/buildTimelineStream';
import type { RailRow } from '../../../../timeline/railGeometry';
import { TIMELINE_GUTTER } from './timelineLayout';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly item: TimelineDayItem;
  readonly railWidth: number;
  readonly rail: RailRow;
  readonly onToggle: () => void;
};

const countLabel = ({ count }: { readonly count: number }): string =>
  count === 1 ? '1 entry' : `${count} entries`;

export const TimelineDayRule = ({ item, rail, railWidth, onToggle }: Props) => {
  const isFolded = item.foldedCount != null && item.foldedCount > 0;
  const rule = (
    <>
      {isFolded && item.foldedCount != null ? (
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/70">
          {countLabel({ count: item.foldedCount })}
        </span>
      ) : null}
      <Divider className="min-w-0 flex-1" />
    </>
  );

  return (
    <div className="flex min-w-0 items-center" style={{ height: item.height }}>
      <span
        className={cn('shrink-0 pr-2 text-2xs font-medium text-muted-foreground', TIMELINE_GUTTER)}
      >
        {item.label}
      </span>
      <span className="relative shrink-0 self-stretch" style={{ width: railWidth }}>
        <TimelineRail rail={rail} width={railWidth} />
      </span>
      {item.isFoldable ? (
        <button
          type="button"
          aria-label={isFolded ? `Unfold ${item.label}` : `Fold ${item.label}`}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md pl-2 pr-1.5 text-left opacity-80 motion-safe:transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
        >
          {rule}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 pl-2 pr-1.5">{rule}</span>
      )}
    </div>
  );
};
