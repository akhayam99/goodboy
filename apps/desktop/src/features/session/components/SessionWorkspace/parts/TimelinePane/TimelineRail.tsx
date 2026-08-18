import { runIdentityStroke } from '../../../../timeline/runIdentity';
import { railColumnX, type RailRow, type RailSegment } from '../../../../timeline/railGeometry';

type Props = {
  readonly rail: RailRow;
  readonly width: number;
};

const LANE_WIDTH = 2;
const SPINE_WIDTH = 1;
const DASH_PATTERN = '3 3';
const RECEDED_CLASS = 'opacity-[var(--rail-strength-receded)]';

const strokeOf = ({ identityIndex }: { readonly identityIndex: number | null }): string =>
  identityIndex == null ? 'var(--color-border)' : runIdentityStroke({ index: identityIndex });

const recededClassOf = ({
  strength,
}: {
  readonly strength: RailSegment['strength'];
}): string | undefined => (strength === 'receded' ? RECEDED_CLASS : undefined);

const segmentKey = ({ segment }: { readonly segment: RailSegment }): string =>
  `${segment.column}:${segment.fromY}:${segment.toY}:${segment.dash}`;

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
        className={recededClassOf({ strength: segment.strength })}
        x1={railColumnX({ column: segment.column })}
        y1={segment.fromY}
        x2={railColumnX({ column: segment.column })}
        y2={segment.toY}
        stroke={strokeOf({ identityIndex: segment.identityIndex })}
        strokeWidth={segment.identityIndex == null ? SPINE_WIDTH : LANE_WIDTH}
        strokeDasharray={segment.dash === 'dashed' ? DASH_PATTERN : undefined}
        strokeLinecap="butt"
        shapeRendering="crispEdges"
      />
    ))}
    {rail.joins.map((join) => (
      <path
        key={`${join.kind}:${join.laneColumn}:${join.anchorY}`}
        className={recededClassOf({ strength: join.strength })}
        d={join.path}
        fill="none"
        stroke={strokeOf({ identityIndex: join.identityIndex })}
        strokeWidth={join.identityIndex == null ? SPINE_WIDTH : LANE_WIDTH}
        strokeDasharray={join.dash === 'dashed' ? DASH_PATTERN : undefined}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    ))}
  </svg>
);
