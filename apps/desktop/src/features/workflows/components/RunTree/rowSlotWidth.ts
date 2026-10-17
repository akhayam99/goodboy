import { RAIL_MARKER_RADIUS, railInsetOf, type RailRow } from '../../../workTreeModel/railGeometry';
import { RUN_TREE_SLOT_WIDTH } from './runTreeSlotWidth';

type Params = {
  readonly rail: RailRow;
  readonly railWidth: number;
  readonly isNested: boolean;
  readonly isFixed?: boolean;
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
  isFixed = false,
  markerRadius = RAIL_MARKER_RADIUS,
}: Params): number => {
  if (isFixed) {
    return RUN_TREE_SLOT_WIDTH;
  }
  if (!isNested) {
    return railWidth;
  }
  const own = railInsetOf({ rail, markerRadius });
  const top = railInsetOf({ rail: topRailOf({ rail }), markerRadius });
  return railWidth + own - top;
};
