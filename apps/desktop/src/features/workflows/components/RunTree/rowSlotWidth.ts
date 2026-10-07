import { RAIL_MARKER_RADIUS, railInsetOf, type RailRow } from '../../../workTreeModel/railGeometry';

type Params = {
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly isNested: boolean;
  readonly markerRadius?: number;
};

const topRailOf = ({ rail }: { readonly rail: RailRow }): RailRow => ({
  ...rail,
  segments: [],
  joins: [],
  markerColumn: 0,
});

export const rowSlotWidth = ({
  rail,
  railWidth,
  isNested,
  markerRadius = RAIL_MARKER_RADIUS,
}: Params): number => {
  if (!isNested) {
    return railWidth;
  }
  const own = railInsetOf({ rail, markerRadius });
  const top = railInsetOf({ rail: topRailOf({ rail }), markerRadius });
  return railWidth + own - top;
};
