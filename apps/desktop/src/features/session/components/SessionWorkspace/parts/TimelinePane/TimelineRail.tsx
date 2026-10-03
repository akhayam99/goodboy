import { TERMINAL_DIM } from '@goodboy/ui';
import { runIdentityStroke } from '../../../../timeline/runIdentity';
import {
  RAIL_EDGE_BLEED,
  railColumnX,
  railLaneSpans,
  type RailRow,
  type RailSegment,
} from '../../../../../workTreeModel/railGeometry';
import { LANE_HIT_WIDTH } from './timelineLayout';
import { TimelineLaneHit } from './TimelineLaneHit';

export type TimelineLaneTarget = {
  readonly laneId: string;
  readonly title: string;
  readonly open: () => void;
};

export type TimelineLaneControl = {
  readonly targetFor: (params: { readonly laneId: string }) => TimelineLaneTarget | null;
  readonly hoveredLaneId: string | null;
  readonly onHover: (params: { readonly laneId: string | null }) => void;
};

type Props = {
  readonly rail: RailRow;
  readonly width: number;
  readonly lanes?: TimelineLaneControl | null;
};

const LANE_WIDTH = 2;
const HOVERED_LANE_WIDTH = 3;
const SPINE_WIDTH = 1;
const DASH_PATTERN = '3 3';
const LANE_WASH_OPACITY = 0.12;

const dashArrayOf = ({ dash }: { readonly dash: RailSegment['dash'] }): string | undefined =>
  dash === 'dashed' ? DASH_PATTERN : undefined;

const strokeOf = ({ identityIndex }: { readonly identityIndex: number | null }): string =>
  identityIndex == null ? 'var(--color-border)' : runIdentityStroke({ index: identityIndex });

const dimOf = ({ isMuted }: { readonly isMuted: boolean }): string | undefined =>
  isMuted ? TERMINAL_DIM : undefined;

type WidthParams = {
  readonly identityIndex: number | null;
  readonly laneId: string | null;
  readonly hoveredLaneId: string | null;
};

const strokeWidthOf = ({ identityIndex, laneId, hoveredLaneId }: WidthParams): number => {
  if (identityIndex == null) {
    return SPINE_WIDTH;
  }
  return laneId !== null && laneId === hoveredLaneId ? HOVERED_LANE_WIDTH : LANE_WIDTH;
};

const segmentKey = ({ segment }: { readonly segment: RailSegment }): string =>
  `${segment.column}:${segment.fromY}:${segment.toY}:${segment.dash}`;

type BleedParams = {
  readonly segment: RailSegment;
  readonly height: number;
};

const bleedSegmentEnds = ({ segment, height }: BleedParams) => {
  if (segment.dash !== 'solid') {
    return { y1: segment.fromY, y2: segment.toY };
  }
  return {
    y1: segment.fromY <= 0 ? -RAIL_EDGE_BLEED : segment.fromY,
    y2: segment.toY >= height ? height + RAIL_EDGE_BLEED : segment.toY,
  };
};

export const TimelineRail = ({ rail, width, lanes = null }: Props) => {
  const hoveredLaneId = lanes?.hoveredLaneId ?? null;
  const spans = lanes === null ? [] : railLaneSpans({ rail });
  const hits = spans.flatMap((span) => {
    const target = lanes?.targetFor({ laneId: span.laneId }) ?? null;
    return target === null ? [] : [{ span, target }];
  });
  return (
    <>
      <svg
        width={width}
        height={rail.height}
        viewBox={`0 0 ${width} ${rail.height}`}
        className="absolute inset-0 overflow-visible"
        aria-hidden
      >
        {hits.map(({ span }) =>
          span.laneId === hoveredLaneId ? (
            <rect
              key={`wash:${span.laneId}:${span.column}`}
              data-testid="timeline-lane-wash"
              x={railColumnX({ column: span.column }) - LANE_HIT_WIDTH / 2}
              y={span.fromY}
              width={LANE_HIT_WIDTH}
              height={span.toY - span.fromY}
              fill={strokeOf({ identityIndex: span.identityIndex })}
              fillOpacity={LANE_WASH_OPACITY}
            />
          ) : null,
        )}
        {rail.segments.map((segment) => (
          <line
            key={segmentKey({ segment })}
            data-testid="timeline-rail-segment"
            className={dimOf({ isMuted: segment.isMuted })}
            x1={railColumnX({ column: segment.column })}
            x2={railColumnX({ column: segment.column })}
            {...bleedSegmentEnds({ segment, height: rail.height })}
            stroke={strokeOf({ identityIndex: segment.identityIndex })}
            strokeWidth={strokeWidthOf({
              identityIndex: segment.identityIndex,
              laneId: segment.laneId,
              hoveredLaneId,
            })}
            strokeDasharray={dashArrayOf({ dash: segment.dash })}
            strokeLinecap="butt"
          />
        ))}
        {rail.joins.map((join) => (
          <path
            key={`${join.kind}:${join.laneColumn}:${join.anchorY}`}
            className={dimOf({ isMuted: join.isMuted })}
            d={join.path}
            fill="none"
            stroke={strokeOf({ identityIndex: join.identityIndex })}
            strokeWidth={strokeWidthOf({
              identityIndex: join.identityIndex,
              laneId: join.laneId,
              hoveredLaneId,
            })}
            strokeDasharray={dashArrayOf({ dash: join.dash })}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {lanes === null
        ? null
        : hits.map(({ span, target }) => (
            <TimelineLaneHit
              key={`hit:${span.laneId}:${span.column}`}
              span={span}
              target={target}
              onHover={lanes.onHover}
            />
          ))}
    </>
  );
};
