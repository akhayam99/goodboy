import type { RailRow } from './railRowsOf';
import {
  RAIL_NODE_CENTER_X,
  RAIL_NODE_CENTER_Y,
  RAIL_NODE_SIZE,
  RAIL_ROW_HEIGHT,
  spineStrokeOf,
} from './railSpec';

type Props = {
  readonly rows: ReadonlyArray<RailRow>;
  readonly width: number;
};

const RADIUS = RAIL_NODE_SIZE / 2;

export const AutoRailSpine = ({ rows, width }: Props) => (
  <svg
    aria-hidden
    width={width}
    height={rows.length * RAIL_ROW_HEIGHT}
    viewBox={`0 0 ${width} ${rows.length * RAIL_ROW_HEIGHT}`}
    className="pointer-events-none absolute left-0 top-0 overflow-visible"
  >
    {rows.slice(1).map((row, index) => {
      const spine = spineStrokeOf({ node: row.node });
      return (
        <line
          key={row.id}
          data-testid="auto-rail-segment"
          x1={RAIL_NODE_CENTER_X}
          x2={RAIL_NODE_CENTER_X}
          y1={index * RAIL_ROW_HEIGHT + RAIL_NODE_CENTER_Y + RADIUS}
          y2={(index + 1) * RAIL_ROW_HEIGHT + RAIL_NODE_CENTER_Y - RADIUS}
          stroke={spine.stroke}
          strokeWidth={2}
          strokeDasharray={spine.dash}
          strokeLinecap="butt"
        />
      );
    })}
  </svg>
);
