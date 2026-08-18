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

const FADE_SPAN = 0.35;

type FadeStop = {
  readonly strength: RailSegment['strength'];
  readonly offset: number;
};

const fadeStops = ({ segment }: { readonly segment: RailSegment }): ReadonlyArray<FadeStop> => {
  const near = segment.strength;
  const far = segment.strength === 'receded' ? 'full' : 'receded';
  const stops: FadeStop[] = [];
  if (segment.fade.atTop) {
    stops.push({ strength: far, offset: 0 }, { strength: near, offset: FADE_SPAN });
  } else {
    stops.push({ strength: near, offset: 0 });
  }
  if (segment.fade.atBottom) {
    stops.push({ strength: near, offset: 1 - FADE_SPAN }, { strength: far, offset: 1 });
  } else {
    stops.push({ strength: near, offset: 1 });
  }
  return stops;
};

type GradientIdParams = {
  readonly rail: RailRow;
  readonly segment: RailSegment;
};

const gradientIdOf = ({ rail, segment }: GradientIdParams): string =>
  `rail-${rail.id.replace(/[^a-zA-Z0-9_-]/g, '-')}-${segment.column}-${segment.fromY}-${segment.toY}-${segment.strength}-${segment.fade.atTop ? 'top' : 'bottom'}`;

const segmentKey = ({ segment }: { readonly segment: RailSegment }): string =>
  `${segment.column}:${segment.fromY}:${segment.toY}:${segment.dash}`;

const faded = ({ segment }: { readonly segment: RailSegment }): boolean =>
  segment.fade.atTop || segment.fade.atBottom;

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
            {fadeStops({ segment }).map((stop) => {
              return (
                <stop
                  key={`${stop.strength}:${stop.offset}`}
                  offset={stop.offset}
                  stopColor={strokeOf({
                    identityIndex: segment.identityIndex,
                    strength: stop.strength,
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
