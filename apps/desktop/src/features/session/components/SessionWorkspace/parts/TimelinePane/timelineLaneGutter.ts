import {
  RAIL_CONTENT_PAD,
  RAIL_COUNT_RADIUS,
  RAIL_LABEL_GAP,
  railColumnX,
  railInsetOf,
  type RailRow,
} from '../../../../../workTreeModel/railGeometry';
import type { TimelineStreamItem } from '../../../../timeline/buildTimelineStream';

type Params = {
  readonly items: ReadonlyArray<TimelineStreamItem>;
  readonly rails: ReadonlyArray<RailRow>;
};

type RailParams = {
  readonly rail: RailRow;
};

const laneClearOf = ({ rail }: RailParams): number => {
  const columns = [
    rail.markerColumn,
    ...rail.segments.map((segment) => segment.column),
    ...rail.joins.flatMap((join) => [join.spineColumn, join.laneColumn]),
  ];
  const widest = Math.max(...columns);
  return railColumnX({ column: widest }) + 1 + RAIL_LABEL_GAP - RAIL_CONTENT_PAD;
};

export const timelineLaneGutterOf = ({ items, rails }: Params): number =>
  items.reduce((widest, item, index) => {
    const rail = rails[index];
    if (rail === undefined) {
      return widest;
    }
    const inset = railInsetOf({
      rail,
      markerRadius: item.kind === 'count' ? RAIL_COUNT_RADIUS : undefined,
    });
    return Math.max(widest, inset, laneClearOf({ rail }));
  }, 0);
