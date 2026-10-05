import { TERMINAL_DIM } from '@goodboy/ui';
import { runIdentityStroke } from '../../../../timeline/runIdentity';
import {
  RAIL_EDGE_BLEED,
  railColumnX,
  railLaneSpans,
  type RailRow,
  type RailSegment,
} from '../../../../../workTreeModel/railGeometry';
import { TimelineLaneHit } from './TimelineLaneHit';

export type TimelineLaneTarget = {
  readonly laneId: string;
  readonly title: string;
  readonly open: () => void;
};

export type TimelineLaneControl = {
  readonly targetFor: (params: { readonly laneId: string }) => TimelineLaneTarget | null;
};

type Props = {
  readonly rail: RailRow;
  readonly width: number;
  readonly lanes?: TimelineLaneControl | null;
};

const LANE_WIDTH = 2;
const SPINE_WIDTH = 1;
const DASH_PATTERN = '3 3';

const dashArrayOf = ({ dash }: { readonly dash: RailSegment['dash'] }): string | undefined =>
  dash === 'dashed' ? DASH_PATTERN : undefined;

const strokeOf = ({ identityIndex }: { readonly identityIndex: number | null }): string =>
  identityIndex == null ? 'var(--color-border)' : runIdentityStroke({ index: identityIndex });

const dimOf = ({ isMuted }: { readonly isMuted: boolean }): string | undefined =>
  isMuted ? TERMINAL_DIM : undefined;

const strokeWidthOf = ({ identityIndex }: { readonly identityIndex: number | null }): number =>
  identityIndex == null ? SPINE_WIDTH : LANE_WIDTH;

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
  const hits =
    lanes === null
      ? []
      : railLaneSpans({ rail }).flatMap((span) => {
          const target = lanes.targetFor({ laneId: span.laneId });
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
        {rail.segments.map((segment) => (
          <line
            key={segmentKey({ segment })}
            data-testid="timeline-rail-segment"
            className={dimOf({ isMuted: segment.isMuted })}
            x1={railColumnX({ column: segment.column })}
            x2={railColumnX({ column: segment.column })}
            {...bleedSegmentEnds({ segment, height: rail.height })}
            stroke={strokeOf({ identityIndex: segment.identityIndex })}
            strokeWidth={strokeWidthOf({ identityIndex: segment.identityIndex })}
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
            strokeWidth={strokeWidthOf({ identityIndex: join.identityIndex })}
            strokeDasharray={dashArrayOf({ dash: join.dash })}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {hits.map(({ span, target }) => (
        <TimelineLaneHit key={`hit:${span.laneId}:${span.column}`} span={span} target={target} />
      ))}
    </>
  );
};
