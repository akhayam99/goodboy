import { runIdentityStroke } from '../../../../timeline/runIdentity';
import { railColumnX, type RailRow, type RailSegment } from '../../../../timeline/railGeometry';

type Props = {
  readonly rail: RailRow;
  readonly width: number;
};

const LANE_WIDTH = 2;
const SPINE_WIDTH = 1;
const DASH_PATTERN = '3 3';

const baseStrokeOf = ({ identityIndex }: { readonly identityIndex: number | null }): string =>
  identityIndex == null ? 'var(--color-border)' : runIdentityStroke({ index: identityIndex });

type StrokeParams = {
  readonly identityIndex: number | null;
  readonly strength: RailSegment['strength'];
};

const strokeOf = ({ identityIndex, strength }: StrokeParams): string => {
  const stroke = baseStrokeOf({ identityIndex });
  if (strength === 'full') {
    return stroke;
  }
  return `color-mix(in oklab, ${stroke} var(--rail-strength-receded), var(--color-background))`;
};

type RecessionStrokeParams = {
  readonly identityIndex: number | null;
  readonly recession: number;
};

const strokeAtRecession = ({ identityIndex, recession }: RecessionStrokeParams): string => {
  if (recession === 0) {
    return strokeOf({ identityIndex, strength: 'full' });
  }
  if (recession === 1) {
    return strokeOf({ identityIndex, strength: 'receded' });
  }
  return `color-mix(in oklab, ${strokeOf({ identityIndex, strength: 'full' })} ${(1 - recession) * 100}%, ${strokeOf({ identityIndex, strength: 'receded' })})`;
};

type GradientIdParams = {
  readonly rail: RailRow;
  readonly segment: RailSegment;
};

const gradientIdOf = ({ rail, segment }: GradientIdParams): string =>
  `rail-${rail.id.replace(/[^a-zA-Z0-9_-]/g, '-')}-${segment.column}-${segment.fromY}-${segment.toY}-${segment.strength}`;

const segmentKey = ({ segment }: { readonly segment: RailSegment }): string =>
  `${segment.column}:${segment.fromY}:${segment.toY}:${segment.dash}`;

const faded = ({ segment }: { readonly segment: RailSegment }): boolean => segment.fade.length > 0;

export const TimelineRail = ({ rail, width }: Props) => (
  <svg
    width={width}
    height={rail.height}
    viewBox={`0 0 ${width} ${rail.height}`}
    className="absolute inset-0"
    aria-hidden
  >
    <defs>
      {rail.segments
        .filter((segment) => faded({ segment }))
        .map((segment) => (
          <linearGradient
            key={gradientIdOf({ rail, segment })}
            id={gradientIdOf({ rail, segment })}
            x1="0"
            y1="0"
            x2="0"
            y2={rail.height}
            gradientUnits="userSpaceOnUse"
          >
            {segment.fade.map((stop) => {
              return (
                <stop
                  key={`${stop.recession}:${stop.offset}`}
                  offset={stop.offset}
                  stopColor={strokeAtRecession({
                    identityIndex: segment.identityIndex,
                    recession: stop.recession,
                  })}
                />
              );
            })}
          </linearGradient>
        ))}
    </defs>
    {rail.segments.map((segment) => (
      <line
        key={segmentKey({ segment })}
        x1={railColumnX({ column: segment.column })}
        y1={segment.fromY}
        x2={railColumnX({ column: segment.column })}
        y2={segment.toY}
        stroke={
          faded({ segment })
            ? `url(#${gradientIdOf({ rail, segment })})`
            : strokeOf({
                identityIndex: segment.identityIndex,
                strength: segment.strength,
              })
        }
        strokeWidth={segment.identityIndex == null ? SPINE_WIDTH : LANE_WIDTH}
        strokeDasharray={segment.dash === 'dashed' ? DASH_PATTERN : undefined}
        strokeLinecap="butt"
        shapeRendering="crispEdges"
      />
    ))}
    {rail.joins.map((join) => (
      <path
        key={`${join.kind}:${join.laneColumn}:${join.anchorY}`}
        d={join.path}
        fill="none"
        stroke={strokeOf({ identityIndex: join.identityIndex, strength: join.strength })}
        strokeWidth={join.identityIndex == null ? SPINE_WIDTH : LANE_WIDTH}
        strokeDasharray={join.dash === 'dashed' ? DASH_PATTERN : undefined}
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    ))}
  </svg>
);
