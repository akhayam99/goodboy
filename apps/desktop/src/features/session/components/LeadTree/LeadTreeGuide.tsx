import { cn } from '@goodboy/ui';
import type { ReactNode } from 'react';
import type { LeadTreeGuide as Guide } from './leadTreeGuidesOf';

type Props = {
  readonly guide: Guide;
  readonly marker: ReactNode;
  readonly unit?: number;
  readonly origin?: number;
  readonly nodeRadius?: number;
  readonly height?: number;
};

const STROKE = 'var(--color-border)';
const CORNER = 6;

export const LEAD_TREE_ROW_HEIGHT = 28;
export const LEAD_TREE_UNIT = 16;
export const LEAD_TREE_ORIGIN = 12;
const NODE_RADIUS = 7;
const NODE_GAP = 4;

type ColumnParams = {
  readonly at: number;
};

type WidthParams = {
  readonly level: number;
  readonly unit?: number;
  readonly origin?: number;
  readonly nodeRadius?: number;
};

export const leadTreeGuideWidthOf = ({
  level,
  unit = LEAD_TREE_UNIT,
  origin = LEAD_TREE_ORIGIN,
  nodeRadius = NODE_RADIUS,
}: WidthParams): number => origin + level * unit + nodeRadius + NODE_GAP;

export const LeadTreeGuide = ({
  guide,
  marker,
  unit = LEAD_TREE_UNIT,
  origin = LEAD_TREE_ORIGIN,
  nodeRadius = NODE_RADIUS,
  height = LEAD_TREE_ROW_HEIGHT,
}: Props) => {
  const { level, trunks, hasNext, hasChildren } = guide;
  const xOf = ({ at }: ColumnParams): number => origin + at * unit;
  const width = leadTreeGuideWidthOf({ level, unit, origin, nodeRadius });
  const mid = height / 2;
  const parentX = xOf({ at: level - 1 });
  const nodeX = xOf({ at: level });
  const reachX = nodeX - nodeRadius - 2;
  return (
    <span data-lead-tree-guide="" className="relative shrink-0 self-stretch" style={{ width }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn('absolute inset-0 overflow-visible')}
        aria-hidden
        fill="none"
        stroke={STROKE}
        strokeWidth={1}
      >
        {trunks.map((isOpen, at) =>
          isOpen ? (
            <line
              key={`trunk:${at}`}
              x1={xOf({ at })}
              x2={xOf({ at })}
              y1={-0.5}
              y2={height + 0.5}
            />
          ) : null,
        )}
        {level === 0 ? null : (
          <>
            {hasNext ? <line x1={parentX} x2={parentX} y1={-0.5} y2={height + 0.5} /> : null}
            <path
              d={`M ${parentX} ${hasNext ? mid - CORNER : -0.5} V ${mid - CORNER} Q ${parentX} ${mid} ${parentX + CORNER} ${mid} H ${reachX}`}
              strokeLinecap="round"
            />
          </>
        )}
        {hasChildren ? (
          <line x1={nodeX} x2={nodeX} y1={mid + nodeRadius + 2} y2={height + 0.5} />
        ) : null}
      </svg>
      <span
        className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        style={{ left: nodeX, top: mid }}
      >
        {marker}
      </span>
    </span>
  );
};
