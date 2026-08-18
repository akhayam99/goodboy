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
const RECEDED_CLASS = 'opacity-[var(--rail-strength-receded)]';

const strokeOf = ({ identityIndex }: { readonly identityIndex: number | null }): string =>
  identityIndex == null ? 'var(--color-border)' : runIdentityStroke({ index: identityIndex });

const FADE_SPAN = 0.35;

const fadeStops = ({ segment }: { readonly segment: RailSegment }): ReadonlyArray<string> => {
  const near = segment.strength === 'receded' ? 1 : 0;
  const far = segment.strength === 'receded' ? 0 : 1;
  const stops: string[] = [];
  if (segment.fade.atTop) {
    stops.push(`${far}:0`, `${near}:${FADE_SPAN}`);
  } else {
    stops.push(`${near}:0`);
  }
  if (segment.fade.atBottom) {
    stops.push(`${near}:${1 - FADE_SPAN}`, `${far}:1`);
  } else {
    stops.push(`${near}:1`);
  }
  return stops;
};

const gradientIdOf = ({ segment }: { readonly segment: RailSegment }): string =>
  `rail-${segment.column}-${segment.fromY}-${segment.toY}-${segment.strength}`;

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
      {rail.segments.filter((segment) => faded({ segment })).map((segment) => (
        <linearGradient
          key={gradientIdOf({ segment })}
          id={gradientIdOf({ segment })}
          x1="0"
          y1={segment.fromY}
          x2="0"
          y2={segment.toY}
          gradientUnits="userSpaceOnUse"
        >
          {fadeStops({ segment }).map((stop) => {
            const [strong, offset] = stop.split(':');
            return (
              <stop
                key={stop}
                offset={offset}
                stopColor={strokeOf({ identityIndex: segment.identityIndex })}
                stopOpacity={strong === '1' ? 'var(--rail-strength-receded)' : '1'}
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
            ? `url(#${gradientIdOf({ segment })})`
            : strokeOf({ identityIndex: segment.identityIndex })
        }
        strokeWidth={segment.identityIndex == null ? SPINE_WIDTH : LANE_WIDTH}
        strokeDasharray={segment.dash === 'dashed' ? DASH_PATTERN : undefined}
        className={
          !faded({ segment }) && segment.strength === 'receded' ? RECEDED_CLASS : undefined
        }
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
        className={join.strength === 'receded' ? RECEDED_CLASS : undefined}
      />
    ))}
  </svg>
);
