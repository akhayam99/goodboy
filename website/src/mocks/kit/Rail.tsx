import './kit.css';
import { railColumnX, runIdentityStroke, type RailRow, type RailSegment } from './railGeometry';

type Props = {
  readonly rail: RailRow;
  readonly width: number;
};

const LANE_WIDTH = 2;
const SPINE_WIDTH = 1;
const DASH_PATTERN = '3 3';
const RAIL_EDGE_BLEED = 1;

const dashArrayOf = (dash: RailSegment['dash']): string | undefined =>
  dash === 'dashed' ? DASH_PATTERN : undefined;

const strokeOf = (identityIndex: number | null): string =>
  identityIndex === null ? 'var(--g-border)' : runIdentityStroke({ index: identityIndex });

const strokeWidthOf = (identityIndex: number | null): number =>
  identityIndex === null ? SPINE_WIDTH : LANE_WIDTH;

const segmentKey = (segment: RailSegment): string =>
  `${segment.column}:${segment.fromY}:${segment.toY}:${segment.dash}`;

const bleedSegmentEnds = ({
  segment,
  height,
}: {
  readonly segment: RailSegment;
  readonly height: number;
}) => {
  if (segment.dash !== 'solid') {
    return { y1: segment.fromY, y2: segment.toY };
  }
  return {
    y1: segment.fromY <= 0 ? -RAIL_EDGE_BLEED : segment.fromY,
    y2: segment.toY >= height ? height + RAIL_EDGE_BLEED : segment.toY,
  };
};

export const Rail = ({ rail, width }: Props) => (
  <svg
    width={width}
    height={rail.height}
    viewBox={`0 0 ${width} ${rail.height}`}
    className="gkRailSvg"
    aria-hidden
  >
    {rail.segments.map((segment) => (
      <line
        key={segmentKey(segment)}
        className={segment.isMuted ? 'gkDim' : undefined}
        x1={railColumnX({ column: segment.column })}
        x2={railColumnX({ column: segment.column })}
        {...bleedSegmentEnds({ segment, height: rail.height })}
        stroke={strokeOf(segment.identityIndex)}
        strokeWidth={strokeWidthOf(segment.identityIndex)}
        strokeDasharray={dashArrayOf(segment.dash)}
        strokeLinecap="butt"
        shapeRendering="crispEdges"
      />
    ))}
    {rail.joins.map((join) => (
      <path
        key={`${join.kind}:${join.laneColumn}:${join.anchorY}`}
        className={join.isMuted ? 'gkDim' : undefined}
        d={join.path}
        fill="none"
        stroke={strokeOf(join.identityIndex)}
        strokeWidth={strokeWidthOf(join.identityIndex)}
        strokeDasharray={dashArrayOf(join.dash)}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    ))}
    {rail.joins.map((join) => {
      if (join.dash !== 'solid') {
        return null;
      }
      const x = railColumnX({
        column: join.kind === 'branch' ? join.laneColumn : join.spineColumn,
      });
      return (
        <line
          key={`bleed:${join.kind}:${join.laneColumn}:${join.anchorY}`}
          className={join.isMuted ? 'gkDim' : undefined}
          x1={x}
          y1={-RAIL_EDGE_BLEED}
          x2={x}
          y2={0}
          stroke={strokeOf(join.identityIndex)}
          strokeWidth={strokeWidthOf(join.identityIndex)}
          strokeLinecap="butt"
          shapeRendering="crispEdges"
        />
      );
    })}
  </svg>
);
