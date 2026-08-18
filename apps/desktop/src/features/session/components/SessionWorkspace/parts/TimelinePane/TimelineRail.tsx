import { runIdentityStroke } from '../../../../timeline/runIdentity';
import {
  railColumnX,
  type RailJoin,
  type RailRow,
  type RailSegment,
} from '../../../../timeline/railGeometry';

type Props = {
  readonly rail: RailRow;
  readonly width: number;
};

const LANE_WIDTH = 2;
const SPINE_WIDTH = 1;
const DASH_PATTERN = '3 3';
const DASHED_OPACITY = 0.45;

const strokeOf = ({ identityIndex }: { readonly identityIndex: number | null }): string =>
  identityIndex == null ? 'var(--color-border)' : runIdentityStroke({ index: identityIndex });

const segmentKey = ({ segment }: { readonly segment: RailSegment }): string =>
  `${segment.column}:${segment.fromY}:${segment.toY}:${segment.dash}`;

const joinPath = ({ join }: { readonly join: RailJoin }): string => {
  const fromX = railColumnX({
    column: join.kind === 'depart' ? join.spineColumn : join.laneColumn,
  });
  const toX = railColumnX({ column: join.kind === 'depart' ? join.laneColumn : join.spineColumn });
  const bend = join.anchorY / 2;
  return `M ${fromX} ${join.anchorY} C ${fromX} ${bend}, ${toX} ${bend}, ${toX} 0`;
};

export const TimelineRail = ({ rail, width }: Props) => (
  <svg
    width={width}
    height={rail.height}
    viewBox={`0 0 ${width} ${rail.height}`}
    className="absolute inset-0"
    aria-hidden
  >
    {rail.segments.map((segment) => (
      <line
        key={segmentKey({ segment })}
        x1={railColumnX({ column: segment.column })}
        y1={segment.fromY}
        x2={railColumnX({ column: segment.column })}
        y2={segment.toY}
        stroke={strokeOf({ identityIndex: segment.identityIndex })}
        strokeWidth={segment.identityIndex == null ? SPINE_WIDTH : LANE_WIDTH}
        strokeDasharray={segment.dash === 'dashed' ? DASH_PATTERN : undefined}
        opacity={segment.dash === 'dashed' ? DASHED_OPACITY : 1}
        shapeRendering="crispEdges"
      />
    ))}
    {rail.joins.map((join) => (
      <path
        key={`${join.kind}:${join.laneColumn}:${join.anchorY}`}
        d={joinPath({ join })}
        fill="none"
        stroke={strokeOf({ identityIndex: join.identityIndex })}
        strokeWidth={join.identityIndex == null ? SPINE_WIDTH : LANE_WIDTH}
        strokeDasharray={join.dash === 'dashed' ? DASH_PATTERN : undefined}
        opacity={join.dash === 'dashed' ? DASHED_OPACITY : 1}
      />
    ))}
  </svg>
);
