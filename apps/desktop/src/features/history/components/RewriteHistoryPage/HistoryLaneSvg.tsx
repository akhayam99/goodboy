import { cn } from '@goodboy/ui';
import { HISTORY_ACTION_CLASSES } from '../../historyActionClasses';
import { lanePath } from '../../historyGraphGeometry';
import type { HistoryAction } from '../../historyRowMarks';

export type LaneColor = HistoryAction | 'lane';

export type LaneNode = {
  readonly key: string;
  readonly y: number;
  readonly color: LaneColor;
  readonly ring: LaneColor | null;
  readonly isHighlighted: boolean;
  readonly isWorking: boolean;
};

type Props = {
  readonly width: number;
  readonly height: number;
  readonly trunkX: number;
  readonly laneX: number;
  readonly mainY: number | null;
  readonly forkY: number | null;
  readonly mainDots: ReadonlyArray<string>;
  readonly nodes: ReadonlyArray<LaneNode>;
  readonly isDashed: boolean;
  readonly isForkOnMain: boolean;
  readonly isTweened?: boolean;
};

const strokeOf = ({ color }: { readonly color: LaneColor }): string =>
  color === 'lane' ? 'stroke-muted-foreground' : HISTORY_ACTION_CLASSES[color].stroke;

const fillOf = ({ color }: { readonly color: LaneColor }): string =>
  color === 'lane' ? 'fill-muted-foreground' : HISTORY_ACTION_CLASSES[color].fill;

export const HistoryLaneSvg = ({
  width,
  height,
  trunkX,
  laneX,
  mainY,
  forkY,
  mainDots,
  nodes,
  isDashed,
  isForkOnMain,
  isTweened = false,
}: Props) => {
  const top = mainY ?? forkY ?? 0;
  const low = nodes[nodes.length - 1];
  const high = nodes[0];
  const dotCount = mainDots.length;
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
    >
      <line
        x1={trunkX}
        y1={top}
        x2={trunkX}
        y2={height}
        strokeWidth={1.75}
        className="stroke-idle"
      />
      {mainY !== null && forkY !== null
        ? mainDots.map((title, index) => (
            <circle
              key={title + String(index)}
              cx={trunkX}
              cy={mainY + (forkY - mainY) * ((index + 1) / (dotCount + 1))}
              r={3}
              className="fill-idle"
            >
              <title>{title}</title>
            </circle>
          ))
        : null}
      {mainY !== null ? (
        <g>
          <circle
            cx={trunkX}
            cy={mainY}
            r={6.5}
            strokeWidth={1.75}
            className="fill-background stroke-idle"
          />
          <circle cx={trunkX} cy={mainY} r={2.3} className="fill-idle" />
        </g>
      ) : null}
      {forkY !== null && low !== undefined && high !== undefined ? (
        <path
          d={lanePath({ trunkX, laneX, forkY, lowY: low.y, topY: high.y })}
          fill="none"
          strokeWidth={2}
          strokeDasharray={isDashed ? '4 4' : undefined}
          className="stroke-muted-foreground"
        />
      ) : null}
      {forkY !== null ? (
        <g>
          <circle
            cx={trunkX}
            cy={forkY}
            r={isForkOnMain ? 6.5 : 5}
            strokeWidth={1.75}
            className="fill-background stroke-idle"
          />
          {isForkOnMain ? <circle cx={trunkX} cy={forkY} r={2.3} className="fill-idle" /> : null}
        </g>
      ) : null}
      {nodes.map((node) => (
        <g
          key={node.key}
          data-lane-node={node.key}
          style={{ transform: `translate(${laneX}px, ${node.y}px)` }}
          className={cn(
            isTweened && 'transition-transform duration-380 ease-out motion-reduce:transition-none',
          )}
        >
          {node.isHighlighted ? (
            <circle
              r={node.ring === null ? 11 : 14}
              fill="none"
              strokeWidth={1.25}
              opacity={0.55}
              className="stroke-foreground"
            />
          ) : null}
          {node.ring !== null ? (
            <circle
              r={10.5}
              fill="none"
              strokeWidth={2}
              className={strokeOf({ color: node.ring })}
            />
          ) : null}
          <circle
            r={7}
            strokeWidth={2}
            strokeDasharray={node.color === 'drop' ? '3 2.4' : undefined}
            className={cn('fill-background', strokeOf({ color: node.color }))}
          />
          {node.color === 'drop' ? (
            <path
              d="M -3 -3 L 3 3 M 3 -3 L -3 3"
              strokeWidth={1.6}
              strokeLinecap="round"
              className={strokeOf({ color: node.color })}
            />
          ) : (
            <circle
              r={2.6}
              className={cn(
                fillOf({ color: node.color }),
                node.isWorking && 'motion-safe:animate-soft-pulse',
              )}
            />
          )}
        </g>
      ))}
    </svg>
  );
};
