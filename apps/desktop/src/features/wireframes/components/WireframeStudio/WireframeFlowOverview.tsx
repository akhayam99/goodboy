import { useMemo } from 'react';
import type { WireframeDocument } from '@goodboy/core';
import type { WireframeIndex } from '../../wireframeIndex';

type Props = {
  readonly document: WireframeDocument;
  readonly index: WireframeIndex;
  readonly currentScreenId: string;
  readonly onSelectScreen: (screenId: string) => void;
};

const BOX_WIDTH = 132;
const BOX_HEIGHT = 44;
const GAP_X = 46;
const PER_ROW = 4;
const PAD = 8;
const ROW_GAP_MIN = 40;
const LANE_OFFSET = 22;
const LANE_STEP = 18;
const LANE_TAIL = 22;
const LANE_CLEARANCE = 8;
const LABEL_CHAR_WIDTH = 5.4;
const LABEL_PAD = 8;
const LABEL_LIFT = 5;
const CORNER = 8;

type Slot = Readonly<{ column: number; row: number }>;

type Span = Readonly<{ start: number; end: number }>;

type RoutedEdge = Readonly<{
  key: string;
  label: string;
  fromRow: number;
  toRow: number;
  band: number;
  x1: number;
  x2: number;
  span: Span;
}>;

type FlowBox = Readonly<{
  screenId: string;
  title: string;
  x: number;
  y: number;
}>;

type FlowEdge = Readonly<{
  key: string;
  label: string;
  path: string;
  labelX: number;
  labelY: number;
}>;

type FlowLayout = Readonly<{
  left: number;
  width: number;
  height: number;
  boxes: ReadonlyArray<FlowBox>;
  edges: ReadonlyArray<FlowEdge>;
}>;

const bandOf = ({
  fromRow,
  toRow,
}: {
  readonly fromRow: number;
  readonly toRow: number;
}): number => {
  if (toRow < fromRow) {
    return fromRow - 1;
  }

  return fromRow;
};

const spanOf = ({
  x1,
  x2,
  label,
}: {
  readonly x1: number;
  readonly x2: number;
  readonly label: string;
}): Span => {
  const labelWidth = label.length * LABEL_CHAR_WIDTH + LABEL_PAD * 2;
  const center = (x1 + x2) / 2;

  return {
    start: Math.min(x1, x2, center - labelWidth / 2),
    end: Math.max(x1, x2, center + labelWidth / 2),
  };
};

const assignLanes = ({ spans }: { readonly spans: ReadonlyArray<Span> }): ReadonlyArray<number> => {
  const lanes: Array<Array<Span>> = [];
  const assigned = spans.map(() => 0);
  const ordered = spans
    .map((span, position) => ({ span, position }))
    .sort((left, right) => left.span.start - right.span.start);

  for (const entry of ordered) {
    const free = lanes.findIndex((taken) =>
      taken.every(
        (other) =>
          entry.span.start >= other.end + LANE_CLEARANCE ||
          other.start >= entry.span.end + LANE_CLEARANCE,
      ),
    );
    if (free === -1) {
      lanes.push([entry.span]);
      assigned[entry.position] = lanes.length - 1;
      continue;
    }

    lanes[free]?.push(entry.span);
    assigned[entry.position] = free;
  }

  return assigned;
};

const edgePath = ({
  x1,
  y1,
  x2,
  y2,
  laneY,
}: {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly laneY: number;
}): string => {
  const across = Math.sign(x2 - x1);
  const enter = Math.sign(laneY - y1);
  const leave = Math.sign(y2 - laneY);
  const radius = Math.min(
    CORNER,
    Math.abs(x2 - x1) / 2,
    Math.abs(laneY - y1),
    Math.abs(y2 - laneY),
  );
  if (across === 0 || radius < 1) {
    return `M ${x1} ${y1} L ${x1} ${laneY} L ${x2} ${laneY} L ${x2} ${y2}`;
  }

  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${laneY - enter * radius}`,
    `Q ${x1} ${laneY} ${x1 + across * radius} ${laneY}`,
    `L ${x2 - across * radius} ${laneY}`,
    `Q ${x2} ${laneY} ${x2} ${laneY + leave * radius}`,
    `L ${x2} ${y2}`,
  ].join(' ');
};

const rowGapOf = ({ laneCount }: { readonly laneCount: number }): number => {
  if (laneCount === 0) {
    return ROW_GAP_MIN;
  }

  return Math.max(ROW_GAP_MIN, LANE_OFFSET + laneCount * LANE_STEP + LANE_TAIL);
};

const buildFlowLayout = ({
  document,
  index,
}: {
  readonly document: WireframeDocument;
  readonly index: WireframeIndex;
}): FlowLayout => {
  const slots = new Map<string, Slot>();
  document.screens.forEach((screen, order) => {
    slots.set(screen.id, { column: order % PER_ROW, row: Math.floor(order / PER_ROW) });
  });

  const outgoingTotal = new Map<string, number>();
  const incomingTotal = new Map<string, number>();
  const linked: Array<{
    readonly key: string;
    readonly label: string;
    readonly fromScreenId: string;
    readonly toScreenId: string;
    readonly from: Slot;
    readonly to: Slot;
  }> = [];
  document.transitions.forEach((transition, order) => {
    const fromScreenId = index.screenByNodeId.get(transition.fromNodeId);
    if (fromScreenId === undefined) {
      return;
    }

    const from = slots.get(fromScreenId);
    const to = slots.get(transition.toScreenId);
    if (from === undefined || to === undefined) {
      return;
    }

    outgoingTotal.set(fromScreenId, (outgoingTotal.get(fromScreenId) ?? 0) + 1);
    incomingTotal.set(transition.toScreenId, (incomingTotal.get(transition.toScreenId) ?? 0) + 1);
    linked.push({
      key: `${transition.fromNodeId}-${transition.toScreenId}-${order}`,
      label: transition.label,
      fromScreenId,
      toScreenId: transition.toScreenId,
      from,
      to,
    });
  });

  const outgoingSeen = new Map<string, number>();
  const incomingSeen = new Map<string, number>();
  const routed: ReadonlyArray<RoutedEdge> = linked.map((edge) => {
    const outOrder = outgoingSeen.get(edge.fromScreenId) ?? 0;
    const inOrder = incomingSeen.get(edge.toScreenId) ?? 0;
    outgoingSeen.set(edge.fromScreenId, outOrder + 1);
    incomingSeen.set(edge.toScreenId, inOrder + 1);
    const outTotal = outgoingTotal.get(edge.fromScreenId) ?? 1;
    const inTotal = incomingTotal.get(edge.toScreenId) ?? 1;
    const x1 =
      PAD +
      edge.from.column * (BOX_WIDTH + GAP_X) +
      Math.round((BOX_WIDTH * (outOrder + 1)) / (outTotal + 1));
    const x2 =
      PAD +
      edge.to.column * (BOX_WIDTH + GAP_X) +
      Math.round((BOX_WIDTH * (inOrder + 1)) / (inTotal + 1));

    return {
      key: edge.key,
      label: edge.label,
      fromRow: edge.from.row,
      toRow: edge.to.row,
      band: bandOf({ fromRow: edge.from.row, toRow: edge.to.row }),
      x1,
      x2,
      span: spanOf({ x1, x2, label: edge.label }),
    };
  });

  const rows = Math.max(1, Math.ceil(document.screens.length / PER_ROW));
  const laneByKey = new Map<string, number>();
  const laneCounts: Array<number> = Array.from({ length: rows }, () => 0);
  for (let band = 0; band < rows; band += 1) {
    const inBand = routed.filter((edge) => edge.band === band);
    const lanes = assignLanes({ spans: inBand.map((edge) => edge.span) });
    inBand.forEach((edge, position) => {
      laneByKey.set(edge.key, lanes[position] ?? 0);
    });
    laneCounts[band] = lanes.length === 0 ? 0 : Math.max(...lanes) + 1;
  }

  const rowTops: Array<number> = [PAD];
  for (let row = 1; row < rows; row += 1) {
    const previous = rowTops[row - 1] ?? PAD;
    rowTops[row] = previous + BOX_HEIGHT + rowGapOf({ laneCount: laneCounts[row - 1] ?? 0 });
  }

  const boxes: Array<FlowBox> = [];
  document.screens.forEach((screen) => {
    const slot = slots.get(screen.id);
    if (slot === undefined) {
      return;
    }

    boxes.push({
      screenId: screen.id,
      title: screen.title,
      x: PAD + slot.column * (BOX_WIDTH + GAP_X),
      y: rowTops[slot.row] ?? PAD,
    });
  });

  const edges: ReadonlyArray<FlowEdge> = routed.map((edge) => {
    const fromTop = rowTops[edge.fromRow] ?? PAD;
    const toTop = rowTops[edge.toRow] ?? PAD;
    const bandTop = rowTops[edge.band] ?? PAD;
    const laneY = bandTop + BOX_HEIGHT + LANE_OFFSET + (laneByKey.get(edge.key) ?? 0) * LANE_STEP;

    return {
      key: edge.key,
      label: edge.label,
      path: edgePath({
        x1: edge.x1,
        y1: edge.toRow < edge.fromRow ? fromTop : fromTop + BOX_HEIGHT,
        x2: edge.x2,
        y2: edge.toRow > edge.fromRow ? toTop : toTop + BOX_HEIGHT,
        laneY,
      }),
      labelX: (edge.x1 + edge.x2) / 2,
      labelY: laneY - LABEL_LIFT,
    };
  });

  const columns = Math.min(Math.max(document.screens.length, 1), PER_ROW);
  const gridRight = PAD + columns * (BOX_WIDTH + GAP_X) - GAP_X;
  const lastLanes = laneCounts[rows - 1] ?? 0;
  const tail = lastLanes === 0 ? PAD : LANE_OFFSET + (lastLanes - 1) * LANE_STEP + PAD;
  const left = Math.min(PAD, ...routed.map((edge) => edge.span.start)) - PAD;
  const right = Math.max(gridRight, ...routed.map((edge) => edge.span.end)) + PAD;

  return {
    left,
    width: right - left,
    height: (rowTops[rows - 1] ?? PAD) + BOX_HEIGHT + tail,
    boxes,
    edges,
  };
};

export const WireframeFlowOverview = ({
  document,
  index,
  currentScreenId,
  onSelectScreen,
}: Props) => {
  const layout = useMemo(() => buildFlowLayout({ document, index }), [document, index]);

  return (
    <div className="overflow-x-auto">
      <svg
        data-testid="wireframe-flow-overview"
        role="img"
        aria-label="Wireframe flow overview"
        viewBox={`${layout.left} 0 ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        className="max-w-full"
      >
        <defs>
          <marker
            id="wireframe-flow-arrow"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" className="fill-muted-foreground" />
          </marker>
        </defs>
        {layout.edges.map((edge) => (
          <path
            key={edge.key}
            d={edge.path}
            fill="none"
            className="stroke-border"
            strokeWidth="1"
            markerEnd="url(#wireframe-flow-arrow)"
          />
        ))}
        {layout.edges.map((edge) => (
          <text
            key={`${edge.key}-label`}
            x={edge.labelX}
            y={edge.labelY}
            textAnchor="middle"
            paintOrder="stroke"
            strokeWidth="3"
            className="fill-muted-foreground stroke-background text-3xs"
          >
            {edge.label}
          </text>
        ))}
        {layout.boxes.map((box) => (
          <g
            key={box.screenId}
            role="button"
            tabIndex={0}
            aria-label={`Go to ${box.title}`}
            className="cursor-pointer"
            onClick={() => onSelectScreen(box.screenId)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                onSelectScreen(box.screenId);
              }
            }}
          >
            <rect
              x={box.x}
              y={box.y}
              width={BOX_WIDTH}
              height={BOX_HEIGHT}
              rx="6"
              className={
                box.screenId === currentScreenId
                  ? 'fill-muted stroke-primary'
                  : 'fill-elevated stroke-border'
              }
              strokeWidth="1"
            />
            <text
              x={box.x + BOX_WIDTH / 2}
              y={box.y + BOX_HEIGHT / 2 + 4}
              textAnchor="middle"
              className="fill-foreground text-2xs"
            >
              {box.title}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
