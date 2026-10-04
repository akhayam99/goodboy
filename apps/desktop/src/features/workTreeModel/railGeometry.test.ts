// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  RAIL_LANE_OFFSET,
  RAIL_SPINE_X,
  layoutTimelineRail,
  railColumnX,
  railLaneSpans,
  type RailGroupInput,
  type RailGroupShape,
  type RailRowInput,
  type RailSegment,
} from './railGeometry';

type RowParams = {
  readonly id: string;
  readonly groupId?: string | null;
  readonly isPending?: boolean;
  readonly markerY?: number | null;
  readonly height?: number;
  readonly topY?: number;
};

const row = ({
  id,
  groupId = null,
  isPending = false,
  markerY = 18,
  height = 36,
  topY = 0,
}: RowParams): RailRowInput => ({ id, groupId, isPending, markerY, height, topY });

const nowRow = (): RailRowInput => row({ id: 'now', markerY: null, height: 48, topY: 12 });

type GroupParams = {
  readonly id: string;
  readonly originRowId: string;
  readonly shape?: RailGroupShape;
  readonly parentGroupId?: string | null;
  readonly identityIndex?: number | null;
  readonly isMuted?: boolean;
};

const group = ({
  id,
  originRowId,
  shape = 'merged',
  parentGroupId = null,
  identityIndex = 0,
  isMuted = false,
}: GroupParams): RailGroupInput => ({
  id,
  originRowId,
  shape,
  parentGroupId,
  identityIndex,
  isMuted,
});

const railRow = (layout: ReturnType<typeof layoutTimelineRail>, id: string) => {
  const found = layout.rows.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no rail row for ${id}`);
  }
  return found;
};

const lanesOf = (layout: ReturnType<typeof layoutTimelineRail>, id: string) =>
  railRow(layout, id).segments.filter((segment) => segment.column > 0);

const spanOf = (layout: ReturnType<typeof layoutTimelineRail>, id: string) =>
  lanesOf(layout, id).map((segment) => `${segment.column}:${segment.fromY}-${segment.toY}`);

type Point = { readonly x: number; readonly y: number };

type Direction = { readonly dx: number; readonly dy: number };

type PathEnds = {
  readonly start: Point;
  readonly startDirection: Direction;
  readonly end: Point;
  readonly endDirection: Direction;
};

const roundUnit = (value: number): number => Math.round(value * 1000) / 1000 + 0;

const unit = ({ dx, dy }: Direction): Direction => {
  const length = Math.hypot(dx, dy);
  return { dx: roundUnit(dx / length), dy: roundUnit(dy / length) };
};

const arcDirections = ({
  from,
  to,
  isPositive,
}: {
  readonly from: Point;
  readonly to: Point;
  readonly isPositive: boolean;
}): readonly [Direction, Direction] => {
  const centers: ReadonlyArray<Point> = [
    { x: from.x, y: to.y },
    { x: to.x, y: from.y },
  ];
  const center =
    centers.find((candidate) => {
      const cross =
        (from.x - candidate.x) * (to.y - candidate.y) -
        (from.y - candidate.y) * (to.x - candidate.x);
      return isPositive ? cross > 0 : cross < 0;
    }) ?? from;
  const turn = ({ point }: { readonly point: Point }): Direction =>
    isPositive
      ? { dx: -(point.y - center.y), dy: point.x - center.x }
      : { dx: point.y - center.y, dy: -(point.x - center.x) };
  return [turn({ point: from }), turn({ point: to })];
};

const pathEnds = ({ path }: { readonly path: string }): PathEnds => {
  const commands = [...path.matchAll(/([MLCA])([^MLCA]*)/g)].map(([, name, args]) => ({
    name,
    values: (args ?? '')
      .split(/[\s,]+/)
      .filter((part) => part !== '')
      .map(Number),
  }));
  let current: Point = { x: 0, y: 0 };
  let start: Point = current;
  let startDirection: Direction | null = null;
  let endDirection: Direction = { dx: 0, dy: 0 };
  for (const { name, values } of commands) {
    const take = (index: number): Point => ({ x: values[index] ?? 0, y: values[index + 1] ?? 0 });
    if (name === 'M') {
      current = take(0);
      start = current;
      continue;
    }
    const next = name === 'C' ? take(4) : name === 'A' ? take(5) : take(0);
    const straight: Direction = { dx: next.x - current.x, dy: next.y - current.y };
    const directions: readonly [Direction, Direction] =
      name === 'C'
        ? [
            { dx: take(0).x - current.x, dy: take(0).y - current.y },
            { dx: next.x - take(2).x, dy: next.y - take(2).y },
          ]
        : name === 'A'
          ? arcDirections({ from: current, to: next, isPositive: values[4] === 1 })
          : [straight, straight];
    startDirection = startDirection ?? unit(directions[0]);
    endDirection = unit(directions[1]);
    current = next;
  }
  return { start, startDirection: startDirection ?? { dx: 0, dy: 0 }, end: current, endDirection };
};

describe('layoutTimelineRail', () => {
  it('branches a run out of its origin marker and climbs to the newest step', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-2', groupId: 'lane' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'origin').joins).toEqual([
      {
        kind: 'branch',
        spineColumn: 0,
        laneColumn: 1,
        laneId: 'lane',
        identityIndex: 0,
        isMuted: false,
        dash: 'solid',
        anchorY: 18,
        path: 'M 24 -1 L 24 0 C 24 8.84, 16.84 18, 8 18',
      },
    ]);
    expect(spanOf(layout, 'step-1')).toEqual(['1:0-36']);
    expect(spanOf(layout, 'step-2')).toEqual(['1:18-36']);
    expect(lanesOf(layout, 'step-2').every((segment) => segment.dash === 'solid')).toBe(true);
  });

  it('keeps every marker of a run on the column the run owns', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child', groupId: 'stub' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [
        group({ id: 'lane', originRowId: 'origin' }),
        group({ id: 'stub', originRowId: 'step-1', parentGroupId: 'lane' }),
      ],
    });

    expect(railRow(layout, 'origin').markerColumn).toBe(0);
    expect(railRow(layout, 'step-1').markerColumn).toBe(1);
    expect(railRow(layout, 'child').markerColumn).toBe(2);
  });

  it('indents a nested fan-out one column past the branch it hangs off', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child-2', groupId: 'stub' }),
        row({ id: 'child-1', groupId: 'stub' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [
        group({ id: 'lane', originRowId: 'origin' }),
        group({ id: 'stub', originRowId: 'step-1', parentGroupId: 'lane' }),
      ],
    });

    expect(layout.columnByGroupId.get('lane')).toBe(1);
    expect(layout.columnByGroupId.get('stub')).toBe(2);
    expect(railRow(layout, 'step-1').joins.map((join) => join.laneColumn)).toEqual([2]);
    expect(railRow(layout, 'step-1').joins[0]?.spineColumn).toBe(1);
    expect(railRow(layout, 'step-1').joins[0]?.path).toBe(
      'M 40 -1 L 40 0 C 40 8.84, 32.84 18, 24 18',
    );
    expect(spanOf(layout, 'child-1')).toEqual(['2:0-36']);
    expect(spanOf(layout, 'child-2')).toEqual(['2:18-36']);
  });

  it('gives every nesting level one more column of indent', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'great-grandchild', groupId: 'stub-3' }),
        row({ id: 'grandchild', groupId: 'stub-2' }),
        row({ id: 'child', groupId: 'stub-1' }),
        row({ id: 'step', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [
        group({ id: 'lane', originRowId: 'origin' }),
        group({ id: 'stub-1', originRowId: 'step', parentGroupId: 'lane' }),
        group({ id: 'stub-2', originRowId: 'child', parentGroupId: 'stub-1' }),
        group({ id: 'stub-3', originRowId: 'grandchild', parentGroupId: 'stub-2' }),
      ],
    });

    expect([...layout.columnByGroupId.values()]).toEqual([1, 2, 3, 4]);
    expect(layout.width).toBe(RAIL_SPINE_X + 4 * RAIL_LANE_OFFSET + 8);
  });

  it('draws the run column through a standalone row that interleaves with it', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-2', groupId: 'lane' }),
        row({ id: 'standalone' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'standalone').markerColumn).toBe(0);
    expect(lanesOf(layout, 'standalone')).toEqual([
      {
        column: 1,
        laneId: 'lane',
        identityIndex: 0,
        isMuted: false,
        dash: 'solid',
        fromY: 0,
        toY: 36,
      },
    ]);
    expect(railRow(layout, 'standalone').joins).toEqual([]);
  });

  it('keeps the spine and the run column continuous through a day rule', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-2', groupId: 'lane' }),
        row({ id: 'day', markerY: 24, height: 48 }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'day').segments).toEqual([
      {
        column: 0,
        laneId: null,
        identityIndex: null,
        isMuted: false,
        dash: 'solid',
        fromY: 0,
        toY: 48,
      },
      {
        column: 1,
        laneId: 'lane',
        identityIndex: 0,
        isMuted: false,
        dash: 'solid',
        fromY: 0,
        toY: 48,
      },
    ]);
  });

  it('stops a finished run at the marker of its newest row', () => {
    const layout = layoutTimelineRail({
      rows: [nowRow(), row({ id: 'step-1', groupId: 'lane' }), row({ id: 'origin' })],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'merged' })],
    });

    expect(lanesOf(layout, 'now')).toEqual([]);
    expect(spanOf(layout, 'step-1')).toEqual(['1:18-36']);
    expect(railRow(layout, 'step-1').joins).toEqual([]);
  });

  it('dashes the stretch that leads into a step still waiting to run', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'pending', groupId: 'lane', isPending: true }),
        row({ id: 'running', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'merged' })],
    });

    expect(lanesOf(layout, 'pending').map((segment) => segment.dash)).toEqual(['dashed']);
    expect(lanesOf(layout, 'running').map((segment) => segment.dash)).toEqual(['dashed', 'solid']);
    expect(railRow(layout, 'origin').joins.map((join) => join.dash)).toEqual(['solid']);
  });

  it('dashes the elbow itself when nothing in the run has started', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'pending-1', groupId: 'lane', isPending: true }), row({ id: 'origin' })],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'origin').joins.map((join) => join.dash)).toEqual(['dashed']);
  });

  it('gives two runs live at the same time a column each', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'b-step', groupId: 'lane-b' }),
        row({ id: 'a-step', groupId: 'lane-a' }),
        row({ id: 'b-origin' }),
        row({ id: 'a-origin' }),
      ],
      groups: [
        group({ id: 'lane-a', originRowId: 'a-origin', identityIndex: 0 }),
        group({ id: 'lane-b', originRowId: 'b-origin', identityIndex: 3 }),
      ],
    });
    const columns = [layout.columnByGroupId.get('lane-a'), layout.columnByGroupId.get('lane-b')];

    expect(new Set(columns).size).toBe(2);
    expect(columns.every((column) => column !== undefined && column >= 1)).toBe(true);
    expect(layout.width).toBe(RAIL_SPINE_X + 2 * RAIL_LANE_OFFSET + 8);
  });

  it('keeps a later run clear of every column an earlier fan-out already holds', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'b-step', groupId: 'lane-b' }),
        row({ id: 'a-grandchild', groupId: 'stub-a-2' }),
        row({ id: 'a-child', groupId: 'stub-a-1' }),
        row({ id: 'a-step', groupId: 'lane-a' }),
        row({ id: 'b-origin' }),
        row({ id: 'a-origin' }),
      ],
      groups: [
        group({ id: 'lane-a', originRowId: 'a-origin', identityIndex: 0 }),
        group({ id: 'lane-b', originRowId: 'b-origin', identityIndex: 1 }),
        group({ id: 'stub-a-1', originRowId: 'a-step', parentGroupId: 'lane-a', identityIndex: 0 }),
        group({
          id: 'stub-a-2',
          originRowId: 'a-child',
          parentGroupId: 'stub-a-1',
          identityIndex: 0,
        }),
      ],
    });
    const columns = [...layout.columnByGroupId.values()];

    expect(new Set(columns).size).toBe(columns.length);
    expect(layout.columnByGroupId.get('lane-a')).toBe(2);
    expect(layout.columnByGroupId.get('lane-b')).toBe(1);
    expect(layout.columnByGroupId.get('stub-a-1')).toBe(3);
    expect(layout.columnByGroupId.get('stub-a-2')).toBe(4);
  });

  it('keeps a nested group one column past its own lane', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'b-child', groupId: 'stub-b' }),
        row({ id: 'b-step', groupId: 'lane-b' }),
        row({ id: 'a-child', groupId: 'stub-a' }),
        row({ id: 'a-step', groupId: 'lane-a' }),
        row({ id: 'b-origin' }),
        row({ id: 'a-origin' }),
      ],
      groups: [
        group({ id: 'lane-a', originRowId: 'a-origin', identityIndex: 0 }),
        group({ id: 'lane-b', originRowId: 'b-origin', identityIndex: 1 }),
        group({ id: 'stub-a', originRowId: 'a-step', parentGroupId: 'lane-a', identityIndex: 0 }),
        group({ id: 'stub-b', originRowId: 'b-step', parentGroupId: 'lane-b', identityIndex: 1 }),
      ],
    });

    expect(layout.columnByGroupId.get('lane-b')).toBe(1);
    expect(layout.columnByGroupId.get('lane-a')).toBe(2);
    expect(layout.columnByGroupId.get('stub-b')).toBe(2);
    expect(layout.columnByGroupId.get('stub-a')).toBe(3);
  });

  it('gives the run met first from the top the leftmost column', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'b-step', groupId: 'lane-b' }),
        row({ id: 'a-step', groupId: 'lane-a' }),
        row({ id: 'b-origin' }),
        row({ id: 'a-origin' }),
      ],
      groups: [
        group({ id: 'lane-a', originRowId: 'a-origin' }),
        group({ id: 'lane-b', originRowId: 'b-origin' }),
      ],
    });

    expect(layout.columnByGroupId.get('lane-b')).toBe(1);
    expect(layout.columnByGroupId.get('lane-a')).toBe(2);
  });

  it('reuses the first column once the run above it has closed', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'b-step', groupId: 'lane-b' }),
        row({ id: 'b-origin' }),
        row({ id: 'a-step', groupId: 'lane-a' }),
        row({ id: 'a-origin' }),
      ],
      groups: [
        group({ id: 'lane-a', originRowId: 'a-origin' }),
        group({ id: 'lane-b', originRowId: 'b-origin' }),
      ],
    });

    expect(layout.columnByGroupId.get('lane-a')).toBe(1);
    expect(layout.columnByGroupId.get('lane-b')).toBe(1);
    expect(layout.width).toBe(RAIL_SPINE_X + RAIL_LANE_OFFSET + 8);
  });

  it('draws a standalone agent chain in the neutral spine ink', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child', groupId: 'stub' }),
        row({ id: 'standalone-agent' }),
        row({ id: 'older' }),
      ],
      groups: [group({ id: 'stub', originRowId: 'standalone-agent', identityIndex: null })],
    });

    expect(railRow(layout, 'standalone-agent').joins.map((join) => join.identityIndex)).toEqual([
      null,
    ]);
    expect(lanesOf(layout, 'child').map((segment) => segment.identityIndex)).toEqual([null]);
    expect(layout.columnByGroupId.get('stub')).toBe(1);
  });

  it('paints a nested group with the identity of the run that owns it', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child', groupId: 'stub' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [
        group({ id: 'lane', originRowId: 'origin', identityIndex: 4, isMuted: true }),
        group({
          id: 'stub',
          originRowId: 'step-1',
          parentGroupId: 'lane',
          identityIndex: 9,
          isMuted: false,
        }),
      ],
    });

    expect(lanesOf(layout, 'child')).toEqual([
      {
        column: 2,
        laneId: 'lane',
        identityIndex: 4,
        isMuted: true,
        dash: 'solid',
        fromY: 18,
        toY: 36,
      },
    ]);
    expect(railRow(layout, 'step-1').joins.map((join) => join.identityIndex)).toEqual([4]);
    expect(railRow(layout, 'step-1').joins.every((join) => join.isMuted)).toBe(true);
  });

  it('leaves a run with no rows of its own on the spine and draws no column', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'origin' })],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(lanesOf(layout, 'origin')).toEqual([]);
    expect(railRow(layout, 'origin').joins).toEqual([]);
    expect(railRow(layout, 'origin').markerColumn).toBe(0);
    expect(layout.columnByGroupId.get('lane')).toBeUndefined();
    expect(layout.width).toBe(RAIL_SPINE_X + 8);
  });

  it('keeps the spine unbroken, neutral and solid on every row', () => {
    const layout = layoutTimelineRail({
      rows: [
        nowRow(),
        row({ id: 'pending', groupId: 'lane', isPending: true }),
        row({ id: 'standalone' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
        row({ id: 'older' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    for (const [index, rail] of layout.rows.entries()) {
      const spine = rail.segments.filter((segment) => segment.column === 0);
      expect(spine.length).toBe(1);
      expect(spine[0]?.identityIndex).toBeNull();
      expect(spine[0]?.dash).toBe('solid');
      expect(spine[0]?.fromY).toBe(index === 0 ? 12 : 0);
      expect(spine[0]?.toY).toBe(rail.height);
    }
  });

  it('places columns one lane offset apart from the spine', () => {
    expect(railColumnX({ column: 0 })).toBe(RAIL_SPINE_X);
    expect(railColumnX({ column: 2 })).toBe(RAIL_SPINE_X + 2 * RAIL_LANE_OFFSET);
  });
});

describe('junction integrity', () => {
  type Fixture = {
    readonly rows: ReadonlyArray<RailRowInput>;
    readonly groups: ReadonlyArray<RailGroupInput>;
  };

  const nested: Fixture = {
    rows: [
      nowRow(),
      row({ id: 'child-2', groupId: 'stub' }),
      row({ id: 'child-1', groupId: 'stub' }),
      row({ id: 'step-2', groupId: 'lane' }),
      row({ id: 'day', markerY: 24, height: 48 }),
      row({ id: 'step-1', groupId: 'lane' }),
      row({ id: 'origin' }),
      row({ id: 'older' }),
    ],
    groups: [
      group({ id: 'lane', originRowId: 'origin' }),
      group({ id: 'stub', originRowId: 'step-1', parentGroupId: 'lane' }),
    ],
  };

  const dangling: Fixture = {
    rows: [
      nowRow(),
      row({ id: 'cluster', groupId: 'lane', isPending: true, markerY: 24, height: 48 }),
      row({ id: 'running', groupId: 'lane' }),
      row({ id: 'done', groupId: 'lane' }),
      row({ id: 'origin' }),
    ],
    groups: [group({ id: 'lane', originRowId: 'origin' })],
  };

  const concurrent: Fixture = {
    rows: [
      nowRow(),
      row({ id: 'b-step', groupId: 'lane-b' }),
      row({ id: 'a-step', groupId: 'lane-a' }),
      row({ id: 'b-origin' }),
      row({ id: 'a-origin' }),
    ],
    groups: [
      group({ id: 'lane-a', originRowId: 'a-origin', identityIndex: 0 }),
      group({ id: 'lane-b', originRowId: 'b-origin', identityIndex: 1 }),
    ],
  };

  const headed: Fixture = {
    rows: [
      nowRow(),
      row({ id: 'child-2', groupId: 'lane' }),
      row({ id: 'child-1', groupId: 'lane' }),
      row({ id: 'origin', groupId: 'head' }),
      row({ id: 'older' }),
    ],
    groups: [
      group({ id: 'head', originRowId: 'origin', shape: 'head', identityIndex: 3 }),
      group({ id: 'lane', originRowId: 'origin', parentGroupId: 'head', identityIndex: 3 }),
    ],
  };

  const fixtures: ReadonlyArray<Fixture> = [nested, dangling, concurrent, headed];

  it('keeps every stroke inside the box of its row', () => {
    for (const fixture of fixtures) {
      const layout = layoutTimelineRail(fixture);
      for (const [index, rail] of layout.rows.entries()) {
        const topY = fixture.rows[index]?.topY ?? 0;
        for (const segment of rail.segments) {
          expect(segment.fromY).toBeGreaterThanOrEqual(topY);
          expect(segment.toY).toBeLessThanOrEqual(rail.height);
          expect(segment.toY).toBeGreaterThan(segment.fromY);
        }
        for (const join of rail.joins) {
          expect(join.anchorY).toBeGreaterThanOrEqual(topY);
          expect(join.anchorY).toBeLessThanOrEqual(rail.height);
        }
      }
    }
  });

  it('leaves a branch row free of a straight run in the column it turns into', () => {
    for (const fixture of fixtures) {
      const layout = layoutTimelineRail(fixture);
      for (const rail of layout.rows) {
        for (const join of rail.joins.filter((candidate) => candidate.kind === 'branch')) {
          expect(rail.segments.filter((segment) => segment.column === join.laneColumn)).toEqual([]);
        }
      }
    }
  });

  it('continues every lane across every row edge in global coordinates', () => {
    for (const fixture of fixtures) {
      const layout = layoutTimelineRail(fixture);
      const tops = layout.rows.reduce<ReadonlyArray<number>>(
        (acc, rail) => [...acc, (acc.at(-1) ?? 0) + rail.height],
        [0],
      );
      const edgeXs = ({
        index,
        edge,
      }: {
        readonly index: number;
        readonly edge: 'top' | 'bottom';
      }): ReadonlyArray<number> => {
        const rail = layout.rows[index];
        const top = tops[index] ?? 0;
        if (rail === undefined) {
          return [];
        }
        const boundary = edge === 'top' ? top : top + rail.height;
        const fromSegments = rail.segments.flatMap((segment) => {
          const reaches =
            edge === 'top' ? top + segment.fromY <= boundary : top + segment.toY >= boundary;
          return reaches ? [railColumnX({ column: segment.column })] : [];
        });
        const fromJoins = rail.joins.flatMap((join) => {
          const ends = pathEnds({ path: join.path });
          return [ends.start, ends.end].flatMap((point) =>
            edge === 'top' && top + point.y <= boundary ? [point.x] : [],
          );
        });
        return [...new Set([...fromSegments, ...fromJoins])].sort(
          (first, second) => first - second,
        );
      };
      for (let index = 0; index < layout.rows.length - 1; index += 1) {
        if ((fixture.rows[index + 1]?.topY ?? 0) > 0) {
          continue;
        }
        expect(edgeXs({ index, edge: 'bottom' })).toEqual(
          edgeXs({ index: index + 1, edge: 'top' }),
        );
      }
    }
  });

  it('leaves every branch straight down from the row top and lands it flat on its marker', () => {
    for (const fixture of fixtures) {
      const layout = layoutTimelineRail(fixture);
      for (const rail of layout.rows) {
        for (const join of rail.joins.filter((candidate) => candidate.kind === 'branch')) {
          const ends = pathEnds({ path: join.path });
          const spineX = railColumnX({ column: join.spineColumn });

          expect(ends.start.x).toBe(railColumnX({ column: join.laneColumn }));
          expect(ends.start.y).toBeLessThanOrEqual(0);
          expect(ends.startDirection).toEqual({ dx: 0, dy: 1 });
          expect(ends.end).toEqual({ x: spineX, y: join.anchorY });
          expect(ends.endDirection.dy).toBe(0);
          expect(railColumnX({ column: rail.markerColumn })).toBe(spineX);
        }
      }
    }
  });

  it('never draws two strokes over the same stretch of one column', () => {
    for (const fixture of fixtures) {
      for (const rail of layoutTimelineRail(fixture).rows) {
        const byColumn = new Map<number, ReadonlyArray<RailSegment>>();
        for (const segment of rail.segments) {
          byColumn.set(segment.column, [...(byColumn.get(segment.column) ?? []), segment]);
        }
        for (const stretches of byColumn.values()) {
          const ordered = [...stretches].sort((first, second) => first.fromY - second.fromY);
          for (let index = 1; index < ordered.length; index += 1) {
            expect(ordered[index]?.fromY).toBeGreaterThanOrEqual(ordered[index - 1]?.toY ?? 0);
          }
        }
      }
    }
  });

  it('never puts two identities on the same column of a row', () => {
    for (const fixture of fixtures) {
      const layout = layoutTimelineRail(fixture);
      for (const rail of layout.rows) {
        const inkByColumn = new Map<number, Set<number | null>>();
        for (const segment of rail.segments) {
          const inks = inkByColumn.get(segment.column) ?? new Set<number | null>();
          inks.add(segment.identityIndex);
          inkByColumn.set(segment.column, inks);
        }
        for (const inks of inkByColumn.values()) {
          expect(inks.size).toBe(1);
        }
      }
    }
  });
});

describe('layoutTimelineRail head lane', () => {
  const headRows = (): ReadonlyArray<RailRowInput> => [
    row({ id: 'child-2', groupId: 'lane' }),
    row({ id: 'child-1', groupId: 'lane' }),
    row({ id: 'origin', groupId: 'head' }),
  ];

  const headGroups = ({
    identityIndex = 3,
  }: { readonly identityIndex?: number | null } = {}): ReadonlyArray<RailGroupInput> => [
    group({ id: 'head', originRowId: 'origin', shape: 'head', identityIndex }),
    group({ id: 'lane', originRowId: 'origin', parentGroupId: 'head', identityIndex }),
  ];

  it('puts the ball one column in and the children one column past it', () => {
    const layout = layoutTimelineRail({ rows: headRows(), groups: headGroups() });

    expect(layout.columnByGroupId.get('head')).toBe(1);
    expect(layout.columnByGroupId.get('lane')).toBe(2);
    expect(railRow(layout, 'origin').markerColumn).toBe(1);
    expect(railRow(layout, 'child-1').markerColumn).toBe(2);
    expect(railRow(layout, 'child-2').markerColumn).toBe(2);
    expect(spanOf(layout, 'child-1')).toEqual(['2:0-36']);
    expect(spanOf(layout, 'child-2')).toEqual(['2:18-36']);
  });

  it('runs a grey stub from the ball down and left into the spine, then branches the lane into the ball', () => {
    const layout = layoutTimelineRail({ rows: headRows(), groups: headGroups() });

    expect(railRow(layout, 'origin').joins).toEqual([
      {
        kind: 'stub',
        spineColumn: 0,
        laneColumn: 1,
        laneId: null,
        identityIndex: null,
        isMuted: false,
        dash: 'solid',
        anchorY: 18,
        path: 'M 24 18 C 15.16 18, 8 27.16, 8 36',
      },
      {
        kind: 'branch',
        spineColumn: 1,
        laneColumn: 2,
        laneId: 'head',
        identityIndex: 3,
        isMuted: false,
        dash: 'solid',
        anchorY: 18,
        path: 'M 40 -1 L 40 0 C 40 8.84, 32.84 18, 24 18',
      },
    ]);
  });

  it('leaves the stub grey whatever identity the run carries', () => {
    for (const identityIndex of [null, 0, 7]) {
      const layout = layoutTimelineRail({
        rows: headRows(),
        groups: headGroups({ identityIndex }),
      });
      const stub = railRow(layout, 'origin').joins.find((join) => join.kind === 'stub');

      expect(stub?.identityIndex).toBeNull();
      expect(stub?.laneId).toBeNull();
      expect(stub?.dash).toBe('solid');
    }
  });

  it('leaves the stub flat out of the ball and vertical into the spine', () => {
    const layout = layoutTimelineRail({ rows: headRows(), groups: headGroups() });
    const stub = railRow(layout, 'origin').joins.find((join) => join.kind === 'stub');
    if (stub === undefined) {
      throw new Error('no stub');
    }
    const ends = pathEnds({ path: stub.path });

    expect(ends.start).toEqual({ x: railColumnX({ column: 1 }), y: stub.anchorY });
    expect(ends.startDirection).toEqual({ dx: -1, dy: 0 });
    expect(ends.end).toEqual({ x: RAIL_SPINE_X, y: railRow(layout, 'origin').height });
    expect(ends.endDirection).toEqual({ dx: 0, dy: 1 });
  });

  it('keeps the stub inside the row when the ball sits near the bottom edge', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child', groupId: 'lane' }),
        row({ id: 'origin', groupId: 'head', markerY: 32, height: 36 }),
      ],
      groups: headGroups(),
    });
    const stub = railRow(layout, 'origin').joins.find((join) => join.kind === 'stub');
    const ends = pathEnds({ path: stub?.path ?? '' });

    expect(ends.end.y).toBe(36);
    expect(ends.endDirection).toEqual({ dx: 0, dy: 1 });
    expect(stub?.path).toBe('M 24 32 C 15.16 32, 8 32, 8 36');
  });

  it('reserves width for the head and the lane columns', () => {
    const layout = layoutTimelineRail({ rows: headRows(), groups: headGroups() });

    expect(layout.width).toBe(RAIL_SPINE_X + 2 * RAIL_LANE_OFFSET + 8);
  });

  it('names the lane ink and the branch after the head', () => {
    const layout = layoutTimelineRail({ rows: headRows(), groups: headGroups() });

    expect(railLaneSpans({ rail: railRow(layout, 'child-1') })).toEqual([
      { laneId: 'head', column: 2, identityIndex: 3, fromY: 0, toY: 36 },
    ]);
    expect(railRow(layout, 'origin').joins.map((join) => join.laneId)).toEqual([null, 'head']);
  });

  it('draws no stub for a head with no children and no lane for it', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'origin', groupId: 'head' })],
      groups: [group({ id: 'head', originRowId: 'origin', shape: 'head', identityIndex: 3 })],
    });

    expect(railRow(layout, 'origin').markerColumn).toBe(1);
    expect(railRow(layout, 'origin').joins.map((join) => join.kind)).toEqual(['stub']);
    expect(lanesOf(layout, 'origin')).toEqual([]);
  });

  it('gives a second head above the first its own ball column and stub', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'b-child', groupId: 'b-lane' }),
        row({ id: 'b-origin', groupId: 'b-head' }),
        row({ id: 'a-child', groupId: 'a-lane' }),
        row({ id: 'a-origin', groupId: 'a-head' }),
      ],
      groups: [
        group({ id: 'b-head', originRowId: 'b-origin', shape: 'head', identityIndex: 1 }),
        group({ id: 'b-lane', originRowId: 'b-origin', parentGroupId: 'b-head', identityIndex: 1 }),
        group({ id: 'a-head', originRowId: 'a-origin', shape: 'head', identityIndex: 2 }),
        group({ id: 'a-lane', originRowId: 'a-origin', parentGroupId: 'a-head', identityIndex: 2 }),
      ],
    });

    expect(railRow(layout, 'a-origin').markerColumn).toBe(1);
    expect(railRow(layout, 'b-origin').markerColumn).toBe(1);
    for (const id of ['a-origin', 'b-origin']) {
      expect(railRow(layout, id).joins.map((join) => join.kind)).toEqual(['stub', 'branch']);
    }
    expect(railRow(layout, 'a-child').markerColumn).toBe(2);
    expect(railRow(layout, 'b-child').markerColumn).toBe(2);
  });

  it('keeps the ball one column past its owner next to an open top-level lane', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child', groupId: 'lane' }),
        row({ id: 'origin', groupId: 'head' }),
        row({ id: 'agent-step', groupId: 'agent' }),
        row({ id: 'agent-origin', groupId: 'agent' }),
      ],
      groups: [
        group({ id: 'agent', originRowId: 'agent-origin', identityIndex: 1 }),
        group({ id: 'head', originRowId: 'origin', shape: 'head', identityIndex: 2 }),
        group({ id: 'lane', originRowId: 'origin', parentGroupId: 'head', identityIndex: 2 }),
      ],
    });

    expect(layout.columnByGroupId.get('head')).toBe(1);
    expect(railRow(layout, 'origin').markerColumn).toBe(1);
    expect(railRow(layout, 'origin').joins.find((join) => join.kind === 'stub')?.laneColumn).toBe(
      1,
    );
    const crossing = railRow(layout, 'origin').segments.filter((segment) => segment.column === 1);
    expect(crossing).toEqual([]);
  });

  it('keeps every ball one column past its owner whatever order the lanes arrive in', () => {
    const rows = [
      row({ id: 'child', groupId: 'lane' }),
      row({ id: 'origin', groupId: 'head' }),
      row({ id: 'agent-step', groupId: 'agent' }),
      row({ id: 'agent-origin', groupId: 'agent' }),
    ];
    const groups = [
      group({ id: 'head', originRowId: 'origin', shape: 'head', identityIndex: 2 }),
      group({ id: 'lane', originRowId: 'origin', parentGroupId: 'head', identityIndex: 2 }),
      group({ id: 'agent', originRowId: 'agent-origin', identityIndex: 1 }),
    ];

    const forward = layoutTimelineRail({ rows, groups });
    const reversed = layoutTimelineRail({ rows, groups: [...groups].reverse() });

    expect(forward.columnByGroupId.get('head')).toBe(1);
    expect(reversed.columnByGroupId.get('head')).toBe(1);
  });
});

describe('layoutTimelineRail down lanes', () => {
  const down = (params: GroupParams): RailGroupInput => ({
    ...group(params),
    direction: 'down',
  });

  it('forks a lane off its origin marker and runs down to its last row', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'origin' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'step-2', groupId: 'lane' }),
      ],
      groups: [down({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'origin').joins).toEqual([
      {
        kind: 'fork',
        spineColumn: 0,
        laneColumn: 1,
        laneId: 'lane',
        identityIndex: 0,
        isMuted: false,
        dash: 'solid',
        anchorY: 18,
        path: 'M 8 18 C 16.84 18, 24 27.16, 24 36',
      },
    ]);
    expect(lanesOf(layout, 'origin')).toEqual([]);
    expect(spanOf(layout, 'step-1')).toEqual(['1:0-36']);
    expect(spanOf(layout, 'step-2')).toEqual(['1:0-18']);
    expect(railRow(layout, 'step-1').markerColumn).toBe(1);
  });

  it('lets the fork leave the marker flat and land vertically on the lane', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'origin' }), row({ id: 'step-1', groupId: 'lane' })],
      groups: [down({ id: 'lane', originRowId: 'origin' })],
    });
    const fork = railRow(layout, 'origin').joins[0];
    const ends = pathEnds({ path: fork?.path ?? '' });

    expect(ends.start).toEqual({ x: RAIL_SPINE_X, y: 18 });
    expect(ends.startDirection).toEqual({ dx: 1, dy: 0 });
    expect(ends.end).toEqual({ x: railColumnX({ column: 1 }), y: 36 });
    expect(ends.endDirection).toEqual({ dx: 0, dy: 1 });
  });

  it('draws the lane through a row that interleaves with it', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'origin' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'day', markerY: 24, height: 48 }),
        row({ id: 'step-2', groupId: 'lane' }),
      ],
      groups: [down({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'day').segments.filter((segment) => segment.column === 1)).toEqual([
      {
        column: 1,
        laneId: 'lane',
        identityIndex: 0,
        isMuted: false,
        dash: 'solid',
        fromY: 0,
        toY: 48,
      },
    ]);
  });

  it('dashes the stretch that leads into a step still waiting to run', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'origin' }),
        row({ id: 'running', groupId: 'lane' }),
        row({ id: 'pending', groupId: 'lane', isPending: true }),
      ],
      groups: [down({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'origin').joins.map((join) => join.dash)).toEqual(['solid']);
    expect(lanesOf(layout, 'running').map((segment) => segment.dash)).toEqual(['solid', 'dashed']);
    expect(lanesOf(layout, 'pending').map((segment) => segment.dash)).toEqual(['dashed']);
  });

  it('dashes the fork itself when nothing in the lane has started', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'origin' }), row({ id: 'pending-1', groupId: 'lane', isPending: true })],
      groups: [down({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'origin').joins.map((join) => join.dash)).toEqual(['dashed']);
  });

  it('indents a nested lane one column past the lane it forks from', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'origin' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'child-1', groupId: 'stub' }),
        row({ id: 'child-2', groupId: 'stub' }),
        row({ id: 'step-2', groupId: 'lane' }),
      ],
      groups: [
        down({ id: 'lane', originRowId: 'origin' }),
        down({ id: 'stub', originRowId: 'step-1', parentGroupId: 'lane' }),
      ],
    });

    expect(layout.columnByGroupId.get('lane')).toBe(1);
    expect(layout.columnByGroupId.get('stub')).toBe(2);
    expect(
      railRow(layout, 'step-1').joins.map((join) => `${join.spineColumn}->${join.laneColumn}`),
    ).toEqual(['1->2']);
    expect(railRow(layout, 'child-2').markerColumn).toBe(2);
    expect(spanOf(layout, 'child-1')).toEqual(['1:0-36', '2:0-36']);
    expect(spanOf(layout, 'child-2')).toEqual(['1:0-36', '2:0-18']);
    expect(layout.width).toBe(RAIL_SPINE_X + 2 * RAIL_LANE_OFFSET + 8);
  });

  it('lets two runs one under the other share a column', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'a-origin' }),
        row({ id: 'a-step', groupId: 'lane-a' }),
        row({ id: 'b-origin' }),
        row({ id: 'b-step', groupId: 'lane-b' }),
      ],
      groups: [
        down({ id: 'lane-a', originRowId: 'a-origin' }),
        down({ id: 'lane-b', originRowId: 'b-origin' }),
      ],
    });

    expect(layout.columnByGroupId.get('lane-a')).toBe(1);
    expect(layout.columnByGroupId.get('lane-b')).toBe(1);
    expect(layout.width).toBe(RAIL_SPINE_X + RAIL_LANE_OFFSET + 8);
  });

  it('leaves a lane with no rows of its own on the spine', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'origin' })],
      groups: [down({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'origin').joins).toEqual([]);
    expect(layout.columnByGroupId.get('lane')).toBeUndefined();
  });

  it('roots a lane on its first row when there is no spine', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-1', groupId: 'run' }),
        row({ id: 'step-2', groupId: 'run' }),
        row({ id: 'step-3', groupId: 'run', isPending: true }),
      ],
      groups: [down({ id: 'run', originRowId: 'step-1', identityIndex: 2 })],
      hasSpine: false,
    });

    expect(layout.width).toBe(RAIL_SPINE_X * 2);
    expect(railRow(layout, 'step-1').markerColumn).toBe(0);
    expect(railRow(layout, 'step-1').joins).toEqual([]);
    expect(railRow(layout, 'step-1').segments).toEqual([
      {
        column: 0,
        laneId: 'run',
        identityIndex: 2,
        isMuted: false,
        dash: 'solid',
        fromY: 18,
        toY: 36,
      },
    ]);
    expect(railRow(layout, 'step-2').segments.map((segment) => segment.dash)).toEqual([
      'solid',
      'dashed',
    ]);
    expect(railRow(layout, 'step-3').segments.map((segment) => segment.dash)).toEqual(['dashed']);
  });

  it("forks a step's children one column right of a spineless run lane", () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-1', groupId: 'run' }),
        row({ id: 'child-1', groupId: 'lane:step-1' }),
        row({ id: 'step-2', groupId: 'run' }),
      ],
      groups: [
        down({ id: 'run', originRowId: 'step-1', identityIndex: 2 }),
        down({ id: 'lane:step-1', originRowId: 'step-1', parentGroupId: 'run', identityIndex: 2 }),
      ],
      hasSpine: false,
    });

    expect(railRow(layout, 'child-1').markerColumn).toBe(1);
    expect(railRow(layout, 'step-1').joins.map((join) => [join.kind, join.spineColumn])).toEqual([
      ['fork', 0],
    ]);
  });
});

describe('railLaneSpans', () => {
  it('names every nested lane after the run lane it belongs to', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child-1', groupId: 'stub' }),
        row({ id: 'step-2', groupId: 'lane' }),
        row({ id: 'between' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [
        group({ id: 'lane', originRowId: 'origin' }),
        group({ id: 'stub', originRowId: 'step-2', parentGroupId: 'lane' }),
      ],
    });

    expect(railLaneSpans({ rail: railRow(layout, 'child-1') })).toEqual([
      { laneId: 'lane', column: 2, identityIndex: 0, fromY: 18, toY: 36 },
    ]);
    expect(railRow(layout, 'step-2').joins.map((join) => join.laneId)).toEqual(['lane']);
    expect(railLaneSpans({ rail: railRow(layout, 'between') })).toEqual([
      { laneId: 'lane', column: 1, identityIndex: 0, fromY: 0, toY: 36 },
    ]);
    expect(railLaneSpans({ rail: railRow(layout, 'step-1') })).toEqual([
      { laneId: 'lane', column: 1, identityIndex: 0, fromY: 0, toY: 36 },
    ]);
  });

  it('leaves the spine and neutral stubs out', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'child', groupId: 'stub' }), row({ id: 'standalone-agent' })],
      groups: [group({ id: 'stub', originRowId: 'standalone-agent', identityIndex: null })],
    });

    expect(railLaneSpans({ rail: railRow(layout, 'child') })).toEqual([]);
    expect(railLaneSpans({ rail: railRow(layout, 'standalone-agent') })).toEqual([]);
  });
});
