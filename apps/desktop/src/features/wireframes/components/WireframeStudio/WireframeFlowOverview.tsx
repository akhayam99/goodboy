import { useMemo } from 'react';
import { cn } from '@goodboy/ui';
import type { WireframeDocument } from '@goodboy/core';
import type { WireframeIndex } from '../../wireframeIndex';

type Props = {
  readonly document: WireframeDocument;
  readonly index: WireframeIndex;
  readonly currentScreenId: string;
  readonly onSelectScreen: (screenId: string) => void;
};

const BOX_WIDTH = 152;
const BOX_HEIGHT = 46;
const ROW_GAP = 24;
const GAP_BARE = 56;
const GAP_MIN = 84;
const GAP_MAX = 268;
const GAP_RISER_GUTTER = 14;
const PAD = 14;
const LABEL_CHAR_WIDTH = 5.6;
const TITLE_CHAR_WIDTH = 6.3;
const TITLE_INSET = 14;
const LABEL_PAD_X = 7;
const LABEL_HEIGHT = 17;
const LABEL_GAP = 7;
const LABEL_LIFT = 6;
const LANE_OFFSET = 22;
const LANE_STEP = 27;
const LANE_CLEARANCE = 10;
const SELF_RISE = 24;
const PLATE_STEP = LABEL_HEIGHT + LABEL_GAP;
const selfClearanceOf = ({ count }: { readonly count: number }): number =>
  count === 0 ? 0 : SELF_RISE + (count - 1) * LANE_STEP + LABEL_LIFT + LABEL_HEIGHT + LABEL_GAP;
const CORNER = 9;
const RISER_INSET = 18;
const RISER_STEP = 11;
const EXTREME = 1_000_000;
const BARYCENTER_PASSES = 4;

type Vec = Readonly<{ x: number; y: number }>;

const round = ({ value }: { readonly value: number }): number => Math.round(value * 10) / 10;

type Span = Readonly<{ start: number; end: number }>;

export type FlowEdgeKind = 'step' | 'skip' | 'back' | 'self';

export type FlowEdgeRole = 'spine' | 'branch' | 'skip' | 'back' | 'self';

const QUIET_PAINT = {
  line: 'stroke-muted-foreground/60',
  head: 'fill-muted-foreground/60',
  plate: 'fill-background stroke-border/60',
  ink: 'fill-muted-foreground',
} as const;

export const FLOW_EDGE_GLYPH = {
  step: null,
  skip: null,
  back: '\u21a9',
  self: '\u21bb',
} as const satisfies Record<FlowEdgeKind, string | null>;

const FLOW_EDGE_DASH = {
  step: undefined,
  skip: undefined,
  back: '4 4',
  self: '1.5 3',
} as const satisfies Record<FlowEdgeKind, string | undefined>;

const EDGE_PAINT = {
  spine: {
    line: 'stroke-muted-foreground/85',
    head: 'fill-muted-foreground/85',
    plate: 'fill-background stroke-border',
    ink: 'fill-foreground/85',
  },
  branch: {
    line: 'stroke-muted-foreground/45',
    head: 'fill-muted-foreground/45',
    plate: 'fill-background stroke-border/60',
    ink: 'fill-muted-foreground',
  },
  skip: QUIET_PAINT,
  back: QUIET_PAINT,
  self: QUIET_PAINT,
} as const satisfies Record<
  FlowEdgeRole,
  Readonly<Record<'line' | 'head' | 'plate' | 'ink', string>>
>;

const EDGE_ROLES = ['spine', 'branch', 'skip', 'back', 'self'] as const;

export type FlowLabel = Readonly<{
  text: string;
  glyph: string | null;
  full: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type FlowEdge = Readonly<{
  key: string;
  kind: FlowEdgeKind;
  role: FlowEdgeRole;
  fromScreenId: string;
  toScreenId: string;
  from: Vec;
  to: Vec;
  laneY: number | null;
  points: ReadonlyArray<Vec>;
  path: string;
  label: FlowLabel | null;
}>;

export type FlowBox = Readonly<{
  screenId: string;
  title: string;
  text: string;
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type FlowLayout = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
  boxes: ReadonlyArray<FlowBox>;
  edges: ReadonlyArray<FlowEdge>;
}>;

type LinkedEdge = Readonly<{
  key: string;
  label: string;
  fromScreenId: string;
  toScreenId: string;
  order: number;
}>;

type ClassifiedEdge = LinkedEdge &
  Readonly<{
    kind: FlowEdgeKind;
    fromRank: number;
    toRank: number;
  }>;

type AnchorSide = 'left' | 'right' | 'top' | 'bottom';

type AnchorRequest = Readonly<{
  screenId: string;
  side: AnchorSide;
  edgeKey: string;
  role: 'out' | 'in';
  sortKey: number;
  order: number;
}>;

type Placed = Readonly<{ screenId: string; rank: number; y: number }>;

const fitText = ({
  text,
  maxWidth,
  charWidth,
}: {
  readonly text: string;
  readonly maxWidth: number;
  readonly charWidth: number;
}): Readonly<{ text: string; full: string | null }> => {
  const maxChars = Math.floor(maxWidth / charWidth);
  if (text.length <= maxChars) {
    return { text, full: null };
  }
  if (maxChars < 2) {
    return { text: '…', full: text };
  }

  return { text: `${text.slice(0, maxChars - 1).trimEnd()}…`, full: text };
};

const plateWidthOf = ({ text }: { readonly text: string }): number =>
  Math.round(text.length * LABEL_CHAR_WIDTH + LABEL_PAD_X * 2);

const GLYPH_WIDTH = LABEL_CHAR_WIDTH * 2;

const labelWidthOf = ({
  text,
  kind,
}: {
  readonly text: string;
  readonly kind: FlowEdgeKind;
}): number => plateWidthOf({ text }) + (FLOW_EDGE_GLYPH[kind] === null ? 0 : GLYPH_WIDTH);

const cutBackEdges = ({
  screenIds,
  successors,
}: {
  readonly screenIds: ReadonlyArray<string>;
  readonly successors: ReadonlyMap<string, ReadonlyArray<string>>;
}): ReadonlySet<string> => {
  const cut = new Set<string>();
  const settled = new Set<string>();
  const open = new Set<string>();
  const walk = (screenId: string): void => {
    open.add(screenId);
    for (const child of successors.get(screenId) ?? []) {
      if (open.has(child)) {
        cut.add(`${screenId}->${child}`);
        continue;
      }
      if (settled.has(child)) {
        continue;
      }
      walk(child);
    }
    open.delete(screenId);
    settled.add(screenId);
  };
  for (const screenId of screenIds) {
    if (settled.has(screenId) === false) {
      walk(screenId);
    }
  }

  return cut;
};

const rankScreens = ({
  screenIds,
  predecessors,
}: {
  readonly screenIds: ReadonlyArray<string>;
  readonly predecessors: ReadonlyMap<string, ReadonlyArray<string>>;
}): ReadonlyMap<string, number> => {
  const ranks = new Map<string, number>();
  const visiting = new Set<string>();
  const rankOf = (screenId: string): number => {
    const known = ranks.get(screenId);
    if (known !== undefined) {
      return known;
    }
    if (visiting.has(screenId)) {
      return 0;
    }
    visiting.add(screenId);
    let best = 0;
    for (const parent of predecessors.get(screenId) ?? []) {
      const candidate = rankOf(parent) + 1;
      if (candidate > best) {
        best = candidate;
      }
    }
    visiting.delete(screenId);
    ranks.set(screenId, best);
    return best;
  };
  for (const screenId of screenIds) {
    rankOf(screenId);
  }

  return ranks;
};

const meanPositionOf = ({
  neighbours,
  positions,
  fallback,
}: {
  readonly neighbours: ReadonlyArray<string>;
  readonly positions: ReadonlyMap<string, number>;
  readonly fallback: number;
}): number => {
  const known = neighbours
    .map((neighbour) => positions.get(neighbour))
    .filter((position): position is number => position !== undefined);
  if (known.length === 0) {
    return fallback;
  }

  return known.reduce((total, position) => total + position, 0) / known.length;
};

const sweepColumn = ({
  column,
  neighboursOf,
  positions,
}: {
  readonly column: ReadonlyArray<string>;
  readonly neighboursOf: (screenId: string) => ReadonlyArray<string>;
  readonly positions: ReadonlyMap<string, number>;
}): ReadonlyArray<string> =>
  column
    .map((screenId, order) => ({
      screenId,
      order,
      weight: meanPositionOf({ neighbours: neighboursOf(screenId), positions, fallback: order }),
    }))
    .sort((left, right) => left.weight - right.weight || left.order - right.order)
    .map((entry) => entry.screenId);

const orderColumns = ({
  columns,
  predecessors,
  successors,
}: {
  readonly columns: ReadonlyArray<ReadonlyArray<string>>;
  readonly predecessors: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly successors: ReadonlyMap<string, ReadonlyArray<string>>;
}): ReadonlyArray<ReadonlyArray<string>> => {
  let current: Array<ReadonlyArray<string>> = columns.map((column) => [...column]);
  for (let pass = 0; pass < BARYCENTER_PASSES; pass += 1) {
    const positions = new Map<string, number>();
    current.forEach((column) => {
      column.forEach((screenId, position) => {
        positions.set(screenId, position);
      });
    });
    const isForward = pass % 2 === 0;
    const order = isForward
      ? current.map((_, rank) => rank).slice(1)
      : current
          .map((_, rank) => rank)
          .slice(0, -1)
          .reverse();
    for (const rank of order) {
      const column = current[rank] ?? [];
      const swept = sweepColumn({
        column,
        neighboursOf: (screenId) =>
          (isForward ? predecessors.get(screenId) : successors.get(screenId)) ?? [],
        positions,
      });
      current[rank] = swept;
      swept.forEach((screenId, position) => {
        positions.set(screenId, position);
      });
    }
  }

  return current;
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

const roundedPath = ({ points }: { readonly points: ReadonlyArray<Vec> }): string => {
  const trimmed = points.filter(
    (point, position) =>
      position === 0 || point.x !== points[position - 1]?.x || point.y !== points[position - 1]?.y,
  );
  const head = trimmed[0];
  const tail = trimmed[trimmed.length - 1];
  if (head === undefined || tail === undefined) {
    return '';
  }
  const parts = [`M ${head.x} ${head.y}`];
  for (let position = 1; position < trimmed.length - 1; position += 1) {
    const before = trimmed[position - 1];
    const corner = trimmed[position];
    const after = trimmed[position + 1];
    if (before === undefined || corner === undefined || after === undefined) {
      continue;
    }
    const inLength = Math.hypot(corner.x - before.x, corner.y - before.y);
    const outLength = Math.hypot(after.x - corner.x, after.y - corner.y);
    const radius = Math.min(CORNER, inLength / 2, outLength / 2);
    if (radius < 1) {
      parts.push(`L ${corner.x} ${corner.y}`);
      continue;
    }
    const entryX = round({ value: corner.x - ((corner.x - before.x) / inLength) * radius });
    const entryY = round({ value: corner.y - ((corner.y - before.y) / inLength) * radius });
    const exitX = round({ value: corner.x + ((after.x - corner.x) / outLength) * radius });
    const exitY = round({ value: corner.y + ((after.y - corner.y) / outLength) * radius });
    parts.push(`L ${entryX} ${entryY}`);
    parts.push(`Q ${corner.x} ${corner.y} ${exitX} ${exitY}`);
  }
  parts.push(`L ${tail.x} ${tail.y}`);

  return parts.join(' ');
};

const stackPlatesAbove = ({
  entries,
  floor,
}: {
  readonly entries: ReadonlyArray<Readonly<{ key: string; runY: number }>>;
  readonly floor: number;
}): ReadonlyMap<string, number> => {
  const stacked = new Map<string, number>();
  const ordered = [...entries].sort((left, right) => right.runY - left.runY);
  ordered.forEach((entry, position) => {
    stacked.set(entry.key, Math.round(floor - LABEL_LIFT - LABEL_HEIGHT - position * PLATE_STEP));
  });

  return stacked;
};

const anchorOffsets = ({ count, extent }: { readonly count: number; readonly extent: number }) =>
  Array.from({ length: count }, (_, position) =>
    Math.round((extent * (position + 1)) / (count + 1)),
  );

export const buildFlowLayout = ({
  document,
  index,
}: {
  readonly document: WireframeDocument;
  readonly index: WireframeIndex;
}): FlowLayout => {
  const screenIds = document.screens.map((screen) => screen.id);
  const known = new Set(screenIds);
  const linked: Array<LinkedEdge> = [];
  document.transitions.forEach((transition, order) => {
    const fromScreenId = index.screenByNodeId.get(transition.fromNodeId);
    if (fromScreenId === undefined || known.has(fromScreenId) === false) {
      return;
    }
    if (known.has(transition.toScreenId) === false) {
      return;
    }

    linked.push({
      key: `${transition.fromNodeId}-${transition.toScreenId}-${order}`,
      label: transition.label,
      fromScreenId,
      toScreenId: transition.toScreenId,
      order,
    });
  });

  const predecessors = new Map<string, Array<string>>();
  const successors = new Map<string, Array<string>>();
  for (const edge of linked) {
    if (edge.fromScreenId === edge.toScreenId) {
      continue;
    }
    const parents = predecessors.get(edge.toScreenId) ?? [];
    parents.push(edge.fromScreenId);
    predecessors.set(edge.toScreenId, parents);
    const children = successors.get(edge.fromScreenId) ?? [];
    children.push(edge.toScreenId);
    successors.set(edge.fromScreenId, children);
  }
  const cut = cutBackEdges({ screenIds, successors });
  const acyclic = new Map<string, Array<string>>();
  for (const [screenId, parents] of predecessors) {
    acyclic.set(
      screenId,
      parents.filter((parent) => cut.has(`${parent}->${screenId}`) === false),
    );
  }
  const acyclicSuccessors = new Map<string, Array<string>>();
  for (const [screenId, children] of successors) {
    acyclicSuccessors.set(
      screenId,
      children.filter((child) => cut.has(`${screenId}->${child}`) === false),
    );
  }

  const ranks = rankScreens({ screenIds, predecessors: acyclic });
  const rankOf = (screenId: string): number => ranks.get(screenId) ?? 0;
  const columnCount = screenIds.reduce(
    (total, screenId) => Math.max(total, rankOf(screenId) + 1),
    1,
  );
  const seeded: Array<Array<string>> = Array.from({ length: columnCount }, () => []);
  for (const screenId of screenIds) {
    seeded[rankOf(screenId)]?.push(screenId);
  }
  const columns = orderColumns({
    columns: seeded,
    predecessors: acyclic,
    successors: acyclicSuccessors,
  });

  const classified: ReadonlyArray<ClassifiedEdge> = linked.map((edge) => {
    const fromRank = rankOf(edge.fromScreenId);
    const toRank = rankOf(edge.toScreenId);
    if (edge.fromScreenId === edge.toScreenId) {
      return { ...edge, kind: 'self', fromRank, toRank };
    }
    if (toRank === fromRank + 1) {
      return { ...edge, kind: 'step', fromRank, toRank };
    }
    if (toRank > fromRank) {
      return { ...edge, kind: 'skip', fromRank, toRank };
    }

    return { ...edge, kind: 'back', fromRank, toRank };
  });

  const lastColumn = columns[columnCount - 1] ?? [];
  const spineKeys = new Set<string>();
  let walker: string | undefined = lastColumn[0] ?? screenIds[screenIds.length - 1];
  while (walker !== undefined && rankOf(walker) > 0) {
    const here = walker;
    const parent = (acyclic.get(here) ?? []).find(
      (candidate) => rankOf(candidate) === rankOf(here) - 1,
    );
    if (parent === undefined) {
      break;
    }
    const onSpine = classified.find(
      (edge) => edge.kind === 'step' && edge.fromScreenId === parent && edge.toScreenId === here,
    );
    if (onSpine !== undefined) {
      spineKeys.add(onSpine.key);
    }
    walker = parent;
  }
  const roleOf = ({ edge }: { readonly edge: ClassifiedEdge }): FlowEdgeRole => {
    if (edge.kind !== 'step') {
      return edge.kind;
    }

    return spineKeys.has(edge.key) ? 'spine' : 'branch';
  };

  const outgoingForward = new Map<string, number>();
  for (const edge of classified) {
    if (edge.kind === 'step') {
      outgoingForward.set(edge.fromScreenId, (outgoingForward.get(edge.fromScreenId) ?? 0) + 1);
    }
  }
  const incomingAll = new Map<string, number>();
  for (const edge of classified) {
    if (edge.kind === 'self') {
      continue;
    }
    incomingAll.set(edge.toScreenId, (incomingAll.get(edge.toScreenId) ?? 0) + 1);
  }

  const stepLabels = new Map<string, Readonly<{ text: string; full: string | null }>>();
  for (const edge of classified) {
    if (edge.kind !== 'step' || edge.label.length === 0) {
      continue;
    }
    stepLabels.set(
      edge.key,
      fitText({
        text: edge.label,
        maxWidth: GAP_MAX - LABEL_GAP * 2 - LABEL_PAD_X * 2,
        charWidth: LABEL_CHAR_WIDTH,
      }),
    );
  }

  const slotCount = Math.max(columnCount - 1, 0);
  const riserLoad = new Map<string, number>();
  const loadRiser = ({ slot, hug }: { readonly slot: number; readonly hug: string }): void => {
    riserLoad.set(`${slot}|${hug}`, (riserLoad.get(`${slot}|${hug}`) ?? 0) + 1);
  };
  for (const edge of classified) {
    if (edge.kind === 'skip') {
      loadRiser({ slot: edge.fromRank, hug: 'start' });
      loadRiser({ slot: edge.toRank - 1, hug: 'end' });
    }
    if (edge.kind === 'back') {
      loadRiser({ slot: edge.fromRank - 1, hug: 'end' });
      loadRiser({ slot: edge.toRank, hug: 'start' });
    }
  }
  const riserDemandOf = ({ slot }: { readonly slot: number }): number => {
    const sideOf = ({ hug }: { readonly hug: string }): number => {
      const count = riserLoad.get(`${slot}|${hug}`) ?? 0;

      return count === 0 ? 0 : RISER_INSET + (count - 1) * RISER_STEP;
    };
    const total = sideOf({ hug: 'start' }) + sideOf({ hug: 'end' });

    return total === 0 ? 0 : total + GAP_RISER_GUTTER;
  };
  const labelDemand: Array<number> = Array.from({ length: slotCount }, () => 0);
  for (const edge of classified) {
    if (edge.kind !== 'step') {
      continue;
    }
    const fitted = stepLabels.get(edge.key);
    if (fitted === undefined) {
      continue;
    }
    const needed = Math.max(GAP_MIN, plateWidthOf({ text: fitted.text }) + LABEL_GAP * 2);
    labelDemand[edge.fromRank] = Math.max(labelDemand[edge.fromRank] ?? 0, needed);
  }
  const gapWidths: ReadonlyArray<number> = Array.from({ length: slotCount }, (_, slot) =>
    Math.max(GAP_BARE, riserDemandOf({ slot }), Math.min(GAP_MAX, labelDemand[slot] ?? 0)),
  );

  const columnX: Array<number> = [0];
  for (let rank = 1; rank < columnCount; rank += 1) {
    columnX[rank] = (columnX[rank - 1] ?? 0) + BOX_WIDTH + (gapWidths[rank - 1] ?? GAP_BARE);
  }

  const selfCount = new Map<string, number>();
  const selfIndex = new Map<string, number>();
  for (const edge of classified) {
    if (edge.kind !== 'self') {
      continue;
    }
    const taken = selfCount.get(edge.fromScreenId) ?? 0;
    selfIndex.set(edge.key, taken);
    selfCount.set(edge.fromScreenId, taken + 1);
  }

  const placed = new Map<string, Placed>();
  columns.forEach((column, rank) => {
    let cursor = Number.NEGATIVE_INFINITY;
    for (const screenId of column) {
      const parents = (acyclic.get(screenId) ?? [])
        .map((parent) => placed.get(parent))
        .filter((entry): entry is Placed => entry !== undefined && entry.rank < rank);
      const onlyParent = parents[0];
      const isSpine =
        parents.length === 1 &&
        (incomingAll.get(screenId) ?? 0) === 1 &&
        onlyParent !== undefined &&
        (outgoingForward.get(onlyParent.screenId) ?? 0) === 1;
      const desired =
        isSpine && onlyParent !== undefined
          ? onlyParent.y
          : parents.length === 0
            ? 0
            : parents.reduce((total, parent) => total + parent.y, 0) / parents.length;
      const floor = cursor + selfClearanceOf({ count: selfCount.get(screenId) ?? 0 });
      const y = Math.round(Math.max(desired, floor));
      placed.set(screenId, { screenId, rank, y });
      cursor = y + BOX_HEIGHT + ROW_GAP;
    }
  });

  const boxes: ReadonlyArray<FlowBox> = document.screens.map((screen) => {
    const spot = placed.get(screen.id);
    const rank = rankOf(screen.id);
    const fitted = fitText({
      text: screen.title,
      maxWidth: BOX_WIDTH - TITLE_INSET * 2,
      charWidth: TITLE_CHAR_WIDTH,
    });

    return {
      screenId: screen.id,
      title: screen.title,
      text: fitted.text,
      rank,
      x: columnX[rank] ?? 0,
      y: spot?.y ?? 0,
      width: BOX_WIDTH,
      height: BOX_HEIGHT,
    };
  });
  const boxByScreenId = new Map(boxes.map((box) => [box.screenId, box]));

  const requests: Array<AnchorRequest> = [];
  for (const edge of classified) {
    const fromBox = boxByScreenId.get(edge.fromScreenId);
    const toBox = boxByScreenId.get(edge.toScreenId);
    if (fromBox === undefined || toBox === undefined) {
      continue;
    }
    const sides: Readonly<Record<FlowEdgeKind, Readonly<{ out: AnchorSide; in: AnchorSide }>>> = {
      step: { out: 'right', in: 'left' },
      skip: { out: 'right', in: 'left' },
      back: { out: 'left', in: 'right' },
      self: { out: 'top', in: 'top' },
    };
    const side = sides[edge.kind];
    const outKey = edge.kind === 'skip' ? -EXTREME : edge.kind === 'back' ? EXTREME : toBox.y;
    const inKey = edge.kind === 'skip' ? -EXTREME : edge.kind === 'back' ? EXTREME : fromBox.y;
    requests.push({
      screenId: edge.fromScreenId,
      side: side.out,
      edgeKey: edge.key,
      role: 'out',
      sortKey: edge.kind === 'self' ? toBox.x : outKey,
      order: edge.order,
    });
    requests.push({
      screenId: edge.toScreenId,
      side: side.in,
      edgeKey: edge.key,
      role: 'in',
      sortKey: edge.kind === 'self' ? fromBox.x : inKey,
      order: edge.order,
    });
  }

  const anchors = new Map<string, Vec>();
  const grouped = new Map<string, Array<AnchorRequest>>();
  for (const request of requests) {
    const slot = `${request.screenId}|${request.side}`;
    const bucket = grouped.get(slot) ?? [];
    bucket.push(request);
    grouped.set(slot, bucket);
  }
  for (const [slot, bucket] of grouped) {
    const [screenId, side] = slot.split('|');
    const box = screenId === undefined ? undefined : boxByScreenId.get(screenId);
    if (box === undefined) {
      continue;
    }
    const ordered = [...bucket].sort(
      (left, right) =>
        left.sortKey - right.sortKey ||
        (left.role === right.role ? 0 : left.role === 'out' ? -1 : 1) ||
        left.order - right.order,
    );
    const isVertical = side === 'left' || side === 'right';
    const offsets = anchorOffsets({
      count: ordered.length,
      extent: isVertical ? box.height : box.width,
    });
    ordered.forEach((request, position) => {
      const offset = offsets[position] ?? 0;
      const point: Vec =
        side === 'left'
          ? { x: box.x, y: box.y + offset }
          : side === 'right'
            ? { x: box.x + box.width, y: box.y + offset }
            : side === 'top'
              ? { x: box.x + offset, y: box.y }
              : { x: box.x + offset, y: box.y + box.height };
      anchors.set(`${request.edgeKey}|${request.role}`, point);
    });
  }

  const contentTop = boxes.reduce(
    (best, box) =>
      Math.min(best, box.y - selfClearanceOf({ count: selfCount.get(box.screenId) ?? 0 })),
    0,
  );
  const contentBottom = boxes.reduce((best, box) => Math.max(best, box.y + box.height), BOX_HEIGHT);

  const channelByKey = new Map<string, number>();
  for (let slot = 0; slot < slotCount; slot += 1) {
    const stripStart = (columnX[slot] ?? 0) + BOX_WIDTH;
    const stripEnd = columnX[slot + 1] ?? stripStart;
    const elbows = classified
      .filter((edge) => {
        const from = anchors.get(`${edge.key}|out`);
        const to = anchors.get(`${edge.key}|in`);

        return (
          edge.kind === 'step' &&
          edge.fromRank === slot &&
          from !== undefined &&
          to !== undefined &&
          from.y !== to.y
        );
      })
      .sort(
        (left, right) =>
          (anchors.get(`${left.key}|in`)?.y ?? 0) - (anchors.get(`${right.key}|in`)?.y ?? 0) ||
          left.order - right.order,
      );
    elbows.forEach((edge, position) => {
      channelByKey.set(
        edge.key,
        Math.round(stripStart + ((stripEnd - stripStart) * (position + 1)) / (elbows.length + 1)),
      );
    });
  }

  const runYsInStrip = (slot: number): ReadonlyArray<number> =>
    classified.flatMap((edge) => {
      const from = anchors.get(`${edge.key}|out`);
      const to = anchors.get(`${edge.key}|in`);
      if (from === undefined || to === undefined) {
        return [];
      }
      if (edge.kind === 'step') {
        return edge.fromRank === slot ? [from.y, to.y] : [];
      }
      if (edge.kind === 'skip') {
        return [
          ...(edge.fromRank === slot ? [from.y] : []),
          ...(edge.toRank - 1 === slot ? [to.y] : []),
        ];
      }
      if (edge.kind === 'back') {
        return [
          ...(edge.fromRank - 1 === slot ? [from.y] : []),
          ...(edge.toRank === slot ? [to.y] : []),
        ];
      }

      return [];
    });

  const gapPlateTops = new Map<string, number>();
  for (let slot = 0; slot < Math.max(columnCount - 1, 0); slot += 1) {
    const runYs = runYsInStrip(slot);
    if (runYs.length === 0) {
      continue;
    }
    const floor = Math.min(...runYs);
    const entries = classified.flatMap((edge) => {
      if (edge.kind !== 'step' || edge.fromRank !== slot) {
        return [];
      }
      const fitted = stepLabels.get(edge.key);
      const from = anchors.get(`${edge.key}|out`);
      const to = anchors.get(`${edge.key}|in`);
      if (fitted === undefined || from === undefined || to === undefined) {
        return [];
      }

      return [{ key: edge.key, runY: Math.min(from.y, to.y) }];
    });
    for (const [key, top] of stackPlatesAbove({ entries, floor })) {
      gapPlateTops.set(key, top);
    }
  }

  const laneEdges = classified.filter((edge) => edge.kind === 'skip' || edge.kind === 'back');
  const laneLabels = new Map<string, Readonly<{ text: string; full: string | null }>>();
  for (const edge of laneEdges) {
    if (edge.label.length === 0) {
      continue;
    }
    laneLabels.set(
      edge.key,
      fitText({ text: edge.label, maxWidth: GAP_MAX, charWidth: LABEL_CHAR_WIDTH }),
    );
  }
  const lastRight = (columnX[columnCount - 1] ?? 0) + BOX_WIDTH;
  const stripOf = ({ slot }: { readonly slot: number }): Span => {
    if (slot < 0) {
      const outer = (columnX[0] ?? 0) - RISER_INSET;
      return { start: outer - LANE_OFFSET, end: outer };
    }
    if (slot > columnCount - 2) {
      return { start: lastRight + RISER_INSET, end: lastRight + RISER_INSET + LANE_OFFSET };
    }

    return { start: (columnX[slot] ?? 0) + BOX_WIDTH, end: columnX[slot + 1] ?? lastRight };
  };
  const riserSeen = new Map<string, number>();
  const riserAt = ({
    slot,
    hug,
  }: {
    readonly slot: number;
    readonly hug: 'start' | 'end';
  }): number => {
    const strip = stripOf({ slot });
    const taken = riserSeen.get(`${slot}|${hug}`) ?? 0;
    riserSeen.set(`${slot}|${hug}`, taken + 1);
    const room = Math.max(strip.end - strip.start - RISER_INSET, 0);
    const offset = Math.min(RISER_INSET + taken * RISER_STEP, RISER_INSET + room / 2);

    return Math.round(hug === 'start' ? strip.start + offset : strip.end - offset);
  };
  const riserByKey = new Map<string, Readonly<{ near: number; far: number }>>();
  for (const edge of laneEdges) {
    const isSkip = edge.kind === 'skip';
    const near = riserAt({
      slot: isSkip ? edge.fromRank : edge.fromRank - 1,
      hug: isSkip ? 'start' : 'end',
    });
    const far = riserAt({
      slot: isSkip ? edge.toRank - 1 : edge.toRank,
      hug: isSkip ? 'end' : 'start',
    });
    riserByKey.set(edge.key, { near, far });
  }

  const laneIndexes = new Map<string, number>();
  const laneCounts = { skip: 0, back: 0 };
  for (const kind of ['skip', 'back'] as const) {
    const inLane = laneEdges.filter((edge) => edge.kind === kind);
    const spans = inLane.map((edge) => {
      const risers = riserByKey.get(edge.key) ?? { near: 0, far: 0 };
      const fitted = laneLabels.get(edge.key);
      const width = fitted === undefined ? 0 : labelWidthOf({ text: fitted.text, kind: edge.kind });
      const center = (risers.near + risers.far) / 2;

      return {
        start: Math.min(risers.near, risers.far, center - width / 2),
        end: Math.max(risers.near, risers.far, center + width / 2),
      };
    });
    const lanes = assignLanes({ spans });
    inLane.forEach((edge, position) => {
      laneIndexes.set(edge.key, lanes[position] ?? 0);
    });
    laneCounts[kind] = lanes.length === 0 ? 0 : Math.max(...lanes) + 1;
  }

  const gapPlateTop = [...gapPlateTops.values()].reduce((best, top) => Math.min(best, top), 0);
  const gapPlateBottom = [...gapPlateTops.values()].reduce(
    (best, top) => Math.max(best, top + LABEL_HEIGHT),
    contentBottom,
  );
  const skipBase = Math.min(contentTop, gapPlateTop) - LANE_OFFSET;
  const backBase = Math.max(contentBottom, gapPlateBottom) + LANE_OFFSET;

  const edges: ReadonlyArray<FlowEdge> = classified.flatMap((edge): ReadonlyArray<FlowEdge> => {
    const from = anchors.get(`${edge.key}|out`);
    const to = anchors.get(`${edge.key}|in`);
    const box = boxByScreenId.get(edge.fromScreenId);
    if (from === undefined || to === undefined || box === undefined) {
      return [];
    }
    if (edge.kind === 'step') {
      const channelX = channelByKey.get(edge.key) ?? Math.round((from.x + to.x) / 2);
      const plateCenter = Math.round((from.x + to.x) / 2);
      const stepPoints: ReadonlyArray<Vec> =
        from.y === to.y
          ? [from, to]
          : [from, { x: channelX, y: from.y }, { x: channelX, y: to.y }, to];
      const fitted = stepLabels.get(edge.key);
      const plateTop = gapPlateTops.get(edge.key);
      const width = fitted === undefined ? 0 : plateWidthOf({ text: fitted.text });

      return [
        {
          key: edge.key,
          kind: edge.kind,
          role: roleOf({ edge }),
          fromScreenId: edge.fromScreenId,
          toScreenId: edge.toScreenId,
          from,
          to,
          laneY: null,
          points: stepPoints,
          path: roundedPath({ points: stepPoints }),
          label:
            fitted === undefined || plateTop === undefined
              ? null
              : {
                  text: fitted.text,
                  glyph: FLOW_EDGE_GLYPH[edge.kind],
                  full: fitted.full,
                  x: Math.round(plateCenter - width / 2),
                  y: plateTop,
                  width,
                  height: LABEL_HEIGHT,
                },
        },
      ];
    }
    if (edge.kind === 'self') {
      const laneY = box.y - SELF_RISE - (selfIndex.get(edge.key) ?? 0) * LANE_STEP;
      const selfPoints: ReadonlyArray<Vec> = [
        from,
        { x: from.x, y: laneY },
        { x: to.x, y: laneY },
        to,
      ];
      const fitted =
        edge.label.length === 0
          ? undefined
          : fitText({
              text: edge.label,
              maxWidth: BOX_WIDTH - LABEL_PAD_X * 2 - GLYPH_WIDTH,
              charWidth: LABEL_CHAR_WIDTH,
            });
      const width = fitted === undefined ? 0 : labelWidthOf({ text: fitted.text, kind: edge.kind });

      return [
        {
          key: edge.key,
          kind: edge.kind,
          role: roleOf({ edge }),
          fromScreenId: edge.fromScreenId,
          toScreenId: edge.toScreenId,
          from,
          to,
          laneY,
          points: selfPoints,
          path: roundedPath({ points: selfPoints }),
          label:
            fitted === undefined
              ? null
              : {
                  text: fitted.text,
                  glyph: FLOW_EDGE_GLYPH[edge.kind],
                  full: fitted.full,
                  x: Math.round(box.x + box.width / 2 - width / 2),
                  y: laneY - LABEL_LIFT - LABEL_HEIGHT,
                  width,
                  height: LABEL_HEIGHT,
                },
        },
      ];
    }

    const lane = laneIndexes.get(edge.key) ?? 0;
    const laneY = edge.kind === 'skip' ? skipBase - lane * LANE_STEP : backBase + lane * LANE_STEP;
    const risers = riserByKey.get(edge.key) ?? { near: from.x, far: to.x };
    const lanePoints: ReadonlyArray<Vec> = [
      from,
      { x: risers.near, y: from.y },
      { x: risers.near, y: laneY },
      { x: risers.far, y: laneY },
      { x: risers.far, y: to.y },
      to,
    ];
    const fitted = laneLabels.get(edge.key);
    const width = fitted === undefined ? 0 : labelWidthOf({ text: fitted.text, kind: edge.kind });
    const plateY = edge.kind === 'skip' ? laneY - LABEL_LIFT - LABEL_HEIGHT : laneY + LABEL_LIFT;

    return [
      {
        key: edge.key,
        kind: edge.kind,
        role: roleOf({ edge }),
        fromScreenId: edge.fromScreenId,
        toScreenId: edge.toScreenId,
        from,
        to,
        laneY,
        points: lanePoints,
        path: roundedPath({ points: lanePoints }),
        label:
          fitted === undefined
            ? null
            : {
                text: fitted.text,
                glyph: FLOW_EDGE_GLYPH[edge.kind],
                full: fitted.full,
                x: Math.round((risers.near + risers.far) / 2 - width / 2),
                y: plateY,
                width,
                height: LABEL_HEIGHT,
              },
      },
    ];
  });

  const xs = [
    ...boxes.flatMap((box) => [box.x, box.x + box.width]),
    ...edges.flatMap((edge) => [edge.from.x, edge.to.x]),
    ...edges.flatMap((edge) => edge.points.map((point) => point.x)),
    ...edges.flatMap((edge) =>
      edge.label === null ? [] : [edge.label.x, edge.label.x + edge.label.width],
    ),
  ];
  const ys = [
    ...boxes.flatMap((box) => [box.y, box.y + box.height]),
    ...edges.flatMap((edge) => edge.points.map((point) => point.y)),
    ...edges.flatMap((edge) =>
      edge.label === null ? [] : [edge.label.y, edge.label.y + edge.label.height],
    ),
  ];
  const left = Math.min(0, ...xs) - PAD;
  const right = Math.max(BOX_WIDTH, ...xs) + PAD;
  const top = Math.min(0, ...ys) - PAD;
  const bottom = Math.max(BOX_HEIGHT, ...ys) + PAD;

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
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
        viewBox={`${layout.left} ${layout.top} ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        className="block"
      >
        <defs>
          {EDGE_ROLES.map((role) => (
            <marker
              key={role}
              id={`wireframe-flow-arrow-${role}`}
              markerUnits="userSpaceOnUse"
              markerWidth="8"
              markerHeight="8"
              refX="7.5"
              refY="4"
              orient="auto"
            >
              <path d="M0.5,0.5 L7.5,4 L0.5,7.5 Z" className={EDGE_PAINT[role].head} />
            </marker>
          ))}
        </defs>
        {layout.edges.map((edge) => (
          <path
            key={edge.key}
            d={edge.path}
            fill="none"
            className={EDGE_PAINT[edge.role].line}
            strokeWidth={edge.role === 'spine' ? 1.5 : 1.25}
            strokeLinecap="round"
            strokeDasharray={FLOW_EDGE_DASH[edge.kind]}
            markerEnd={`url(#wireframe-flow-arrow-${edge.role})`}
          />
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
              width={box.width}
              height={box.height}
              rx="7"
              className={
                box.screenId === currentScreenId
                  ? 'fill-muted stroke-primary'
                  : 'fill-elevated stroke-border'
              }
              strokeWidth="1"
            />
            <text
              x={box.x + box.width / 2}
              y={box.y + box.height / 2 + 4}
              textAnchor="middle"
              className="fill-foreground text-2xs"
            >
              {box.text}
              {box.text === box.title ? null : <title>{box.title}</title>}
            </text>
          </g>
        ))}
        {layout.edges.map((edge) =>
          edge.label === null ? null : (
            <g key={`${edge.key}-label`}>
              <rect
                x={edge.label.x}
                y={edge.label.y}
                width={edge.label.width}
                height={edge.label.height}
                rx="4"
                className={EDGE_PAINT[edge.role].plate}
                strokeWidth="1"
              />
              <text
                x={edge.label.x + edge.label.width / 2}
                y={edge.label.y + edge.label.height / 2 + 3.5}
                textAnchor="middle"
                className={cn('text-3xs', EDGE_PAINT[edge.role].ink)}
              >
                {edge.label.glyph === null ? null : (
                  <tspan aria-hidden>{`${edge.label.glyph} `}</tspan>
                )}
                {edge.label.text}
                {edge.label.full === null ? null : <title>{edge.label.full}</title>}
              </text>
            </g>
          ),
        )}
      </svg>
    </div>
  );
};
