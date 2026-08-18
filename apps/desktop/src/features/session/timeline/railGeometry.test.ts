import { describe, expect, it } from 'vitest';
import {
  RAIL_LANE_OFFSET,
  RAIL_SPINE_X,
  layoutTimelineRail,
  railColumnX,
  type RailGroupInput,
  type RailGroupShape,
  type RailJoin,
  type RailRowInput,
  type RailSegment,
} from './railGeometry';

type RowParams = {
  readonly id: string;
  readonly groupId?: string | null;
  readonly isPending?: boolean;
  readonly markerY?: number | null;
  readonly topAnchorY?: number | null;
  readonly height?: number;
  readonly topY?: number;
};

const row = ({
  id,
  groupId = null,
  isPending = false,
  markerY = 18,
  topAnchorY = null,
  height = 36,
  topY = 0,
}: RowParams): RailRowInput => ({ id, groupId, isPending, markerY, topAnchorY, height, topY });

type GroupParams = {
  readonly id: string;
  readonly originRowId: string;
  readonly shape?: RailGroupShape;
  readonly parentGroupId?: string | null;
  readonly identityIndex?: number | null;
};

const group = ({
  id,
  originRowId,
  shape = 'merged',
  parentGroupId = null,
  identityIndex = 0,
}: GroupParams): RailGroupInput => ({ id, originRowId, shape, parentGroupId, identityIndex });

const railRow = (layout: ReturnType<typeof layoutTimelineRail>, id: string) => {
  const found = layout.rows.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`no rail row for ${id}`);
  }
  return found;
};

const lanesOf = (layout: ReturnType<typeof layoutTimelineRail>, id: string) =>
  railRow(layout, id).segments.filter((segment) => segment.column > 0);

const spineOf = (layout: ReturnType<typeof layoutTimelineRail>, id: string) =>
  railRow(layout, id).segments.filter((segment) => segment.column === 0);

type CubicCoordinates = {
  readonly startX: number;
  readonly startY: number;
  readonly firstControlX: number;
  readonly secondControlX: number;
  readonly endX: number;
  readonly endY: number;
};

type CubicCoordinatesParams = {
  readonly join: RailJoin;
};

const cubicCoordinatesOf = ({ join }: CubicCoordinatesParams): CubicCoordinates => {
  const [startX, startY, firstControlX, , secondControlX, , endX, endY] =
    join.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (
    startX === undefined ||
    startY === undefined ||
    firstControlX === undefined ||
    secondControlX === undefined ||
    endX === undefined ||
    endY === undefined
  ) {
    throw new Error(`invalid rail cubic ${join.path}`);
  }
  return { startX, startY, firstControlX, secondControlX, endX, endY };
};

describe('layoutTimelineRail', () => {
  it('departs the spine at the origin row and travels upward to the newest step', () => {
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
        kind: 'depart',
        spineColumn: 0,
        laneColumn: 1,
        identityIndex: 0,
        dash: 'solid',
        anchorY: 18,
        path: 'M 8 18 C 16.84 18, 24 9.9414, 24 0',
      },
    ]);
    expect(railRow(layout, 'origin').markerColumn).toBe(0);
    expect(railRow(layout, 'step-1').markerColumn).toBe(1);
    expect(railRow(layout, 'step-2').markerColumn).toBe(0);
  });

  it('builds a departure from the marker to a vertical lane edge with the reviewed quarter arc', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-1', groupId: 'lane', height: 32, markerY: 16 }),
        row({ id: 'origin', height: 32, markerY: 16 }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(railRow(layout, 'origin').joins[0]?.path).toBe('M 8 16 C 16.84 16, 24 8.8368, 24 0');
  });

  it('merges a finished run back into the spine at its newest row', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'step-1', groupId: 'lane' }), row({ id: 'origin' })],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'merged' })],
    });

    expect(railRow(layout, 'step-1').joins.map((join) => join.kind)).toEqual(['merge']);
    expect(lanesOf(layout, 'step-1')).toEqual([]);
  });

  it('builds a merge from the vertical lane edge into a marker moved onto the spine', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-1', groupId: 'lane', height: 32, markerY: 16 }),
        row({ id: 'origin', height: 32, markerY: 16 }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });
    const merged = railRow(layout, 'step-1');

    expect(merged.joins[0]?.path).toBe('M 24 32 C 24 23.16, 16.84 16, 8 16');
    expect(merged.markerColumn).toBe(0);
    expect(lanesOf(layout, 'step-1')).toEqual([]);
  });

  it('crosses row edges only at integer columns with a vertical tangent', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child', groupId: 'stub', height: 32, markerY: 16 }),
        row({ id: 'step', groupId: 'lane', height: 32, markerY: 16 }),
        row({ id: 'origin', height: 32, markerY: 16 }),
      ],
      groups: [
        group({ id: 'lane', originRowId: 'origin' }),
        group({ id: 'stub', originRowId: 'step', parentGroupId: 'lane' }),
      ],
    });

    for (const rail of layout.rows) {
      for (const join of rail.joins) {
        const coordinates = cubicCoordinatesOf({ join });
        const edgeX = join.kind === 'depart' ? coordinates.endX : coordinates.startX;
        const tangentX =
          join.kind === 'depart' ? coordinates.secondControlX : coordinates.firstControlX;
        const edgeY = join.kind === 'depart' ? coordinates.endY : coordinates.startY;
        expect(Number.isInteger(edgeX)).toBe(true);
        expect(tangentX).toBe(edgeX);
        expect(edgeY).toBe(join.kind === 'depart' ? 0 : rail.height);
      }
    }
  });

  it('terminates every junction under its row marker', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child', groupId: 'stub', height: 32, markerY: 16 }),
        row({ id: 'step', groupId: 'lane', height: 32, markerY: 16 }),
        row({ id: 'origin', height: 32, markerY: 16 }),
      ],
      groups: [
        group({ id: 'lane', originRowId: 'origin' }),
        group({ id: 'stub', originRowId: 'step', parentGroupId: 'lane' }),
      ],
    });

    for (const rail of layout.rows) {
      for (const join of rail.joins) {
        const coordinates = cubicCoordinatesOf({ join });
        const terminalX = join.kind === 'depart' ? coordinates.startX : coordinates.endX;
        const terminalY = join.kind === 'depart' ? coordinates.startY : coordinates.endY;
        expect(terminalX).toBe(railColumnX({ column: rail.markerColumn }));
        expect(terminalY).toBe(join.anchorY);
      }
    }
  });

  it('dangles an unfinished run toward NOW instead of merging', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'now', markerY: null, height: 48, topY: 12 }),
        row({ id: 'newer-entry' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'open' })],
    });

    expect(railRow(layout, 'step-1').joins).toEqual([]);
    expect(lanesOf(layout, 'newer-entry')).toEqual([
      { column: 1, identityIndex: 0, dash: 'dashed', fromY: 0, toY: 36 },
    ]);
    expect(lanesOf(layout, 'now')).toEqual([
      { column: 1, identityIndex: 0, dash: 'dashed', fromY: 12, toY: 48 },
    ]);
  });

  it('ends an open lane at its topmost pending row instead of dangling past it', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'now', markerY: null, height: 48, topY: 12 }),
        row({ id: 'pending', groupId: 'lane', isPending: true }),
        row({ id: 'done', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'open' })],
    });

    expect(railRow(layout, 'pending').joins).toEqual([
      {
        kind: 'merge',
        spineColumn: 0,
        laneColumn: 1,
        identityIndex: 0,
        dash: 'dashed',
        anchorY: 18,
        path: 'M 24 36 C 24 27.16, 16.84 18, 8 18',
      },
    ]);
    expect(lanesOf(layout, 'pending')).toEqual([]);
    expect(lanesOf(layout, 'now')).toEqual([]);
  });

  it('anchors the merge under the marker of a compressed pending stretch', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({
          id: 'cluster',
          groupId: 'lane',
          isPending: true,
          markerY: 24,
          topAnchorY: 8,
          height: 48,
        }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'open' })],
    });

    expect(railRow(layout, 'cluster').joins.map((join) => join.anchorY)).toEqual([24]);
    expect(lanesOf(layout, 'cluster')).toEqual([]);
    expect(railRow(layout, 'cluster').markerY).toBe(24);
  });

  it('draws the lane through a standalone row that interleaves with the run', () => {
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
      { column: 1, identityIndex: 0, dash: 'solid', fromY: 0, toY: 36 },
    ]);
  });

  it('keeps the spine and the lane continuous through a day boundary', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-2', groupId: 'lane' }),
        row({ id: 'day', markerY: 24, height: 48 }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });
    const dayRail = railRow(layout, 'day');

    expect(dayRail.segments).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', fromY: 0, toY: 48 },
      { column: 1, identityIndex: 0, dash: 'solid', fromY: 0, toY: 48 },
    ]);
  });

  it('puts a fan-out stub one offset past the lane it hangs off', () => {
    const layout = layoutTimelineRail({
      rows: [
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
    expect(
      railRow(layout, 'step-1').joins.map((join) => `${join.kind}:${join.laneColumn}`),
    ).toEqual(['merge:1', 'depart:2']);
    expect(railRow(layout, 'step-1').markerColumn).toBe(0);
    expect(railRow(layout, 'child-1').markerColumn).toBe(1);
    expect(layout.width).toBe(RAIL_SPINE_X + 2 * RAIL_LANE_OFFSET + 8);
  });

  it('gives the run met first from the top the leftmost slot so lanes never cross', () => {
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

    expect(layout.columnByGroupId.get('lane-b')).toBe(1);
    expect(layout.columnByGroupId.get('lane-a')).toBe(2);
  });

  it('reuses a slot once the earlier run has merged back', () => {
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

    expect(layout.columnByGroupId.get('lane-b')).toBe(1);
    expect(layout.width).toBe(RAIL_SPINE_X + RAIL_LANE_OFFSET + 8);
  });

  it('turns dashed above the running step and stays solid below it', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'pending-2', groupId: 'lane', isPending: true }),
        row({ id: 'running', groupId: 'lane' }),
        row({ id: 'done-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'open' })],
    });

    expect(railRow(layout, 'pending-2').joins.map((join) => join.dash)).toEqual(['dashed']);
    expect(lanesOf(layout, 'pending-2')).toEqual([]);
    expect(lanesOf(layout, 'running')).toEqual([
      { column: 1, identityIndex: 0, dash: 'solid', fromY: 18, toY: 36 },
      { column: 1, identityIndex: 0, dash: 'dashed', fromY: 0, toY: 18 },
    ]);
    expect(lanesOf(layout, 'done-1').map((segment) => segment.dash)).toEqual(['solid']);
  });

  it('dashes the departure itself when nothing in the run has started', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'pending-1', groupId: 'lane', isPending: true }), row({ id: 'origin' })],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'open' })],
    });

    expect(railRow(layout, 'origin').joins.map((join) => join.dash)).toEqual(['dashed']);
  });

  it('leaves a run with no steps of its own on the spine and draws no lane', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'origin' })],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(lanesOf(layout, 'origin')).toEqual([]);
    expect(railRow(layout, 'origin').joins).toEqual([]);
    expect(railRow(layout, 'origin').markerColumn).toBe(0);
  });

  it('keeps the spine unbroken and neutral on every row even where a branch is live', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'newer' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
        row({ id: 'older' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    for (const rail of layout.rows) {
      const spine = rail.segments.filter((segment) => segment.column === 0);
      expect(spine.length).toBeGreaterThan(0);
      expect(spine.every((segment) => segment.identityIndex === null)).toBe(true);
      expect(spine[0]?.fromY).toBe(0);
      expect(spine[spine.length - 1]?.toY).toBe(rail.height);
      expect(
        spine.every((segment, index) => index === 0 || segment.fromY === spine[index - 1]?.toY),
      ).toBe(true);
    }
  });

  it('never dashes the spine, since dashed speaks about a line and not about a branch', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'pending', groupId: 'lane', isPending: true }),
        row({ id: 'standalone' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'open' })],
    });

    for (const rail of layout.rows) {
      const spine = rail.segments.filter((segment) => segment.column === 0);
      expect(spine.every((segment) => segment.dash === 'solid')).toBe(true);
    }
  });

  it('draws a lane dashed when its future is handed to a live child', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-2', groupId: 'lane', isPending: true }),
        row({ id: 'child-1', groupId: 'stub' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [
        group({ id: 'lane', originRowId: 'origin', shape: 'open' }),
        group({ id: 'stub', originRowId: 'step-1', parentGroupId: 'lane' }),
      ],
    });

    expect(lanesOf(layout, 'child-1')).toEqual([
      { column: 1, identityIndex: 0, dash: 'dashed', fromY: 0, toY: 36 },
    ]);
  });

  it('gives every nesting level its own lane so no marker falls back to the spine', () => {
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

  it('draws a standalone agent fan-out in the neutral spine ink, not a run colour', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'child', groupId: 'stub' }),
        row({ id: 'standalone-agent' }),
        row({ id: 'older' }),
      ],
      groups: [group({ id: 'stub', originRowId: 'standalone-agent', identityIndex: null })],
    });

    expect(railRow(layout, 'child').joins.map((join) => join.identityIndex)).toEqual([null]);
    expect(railRow(layout, 'standalone-agent').joins.map((join) => join.identityIndex)).toEqual([
      null,
    ]);
  });

  it('places lane columns one offset apart from the spine', () => {
    expect(railColumnX({ column: 0 })).toBe(RAIL_SPINE_X);
    expect(railColumnX({ column: 2 })).toBe(RAIL_SPINE_X + 2 * RAIL_LANE_OFFSET);
  });
});

describe('junction integrity', () => {
  type Fixture = {
    readonly rows: ReadonlyArray<RailRowInput>;
    readonly groups: ReadonlyArray<RailGroupInput>;
  };

  const saturated: Fixture = {
    rows: [
      row({ id: 'c-step', groupId: 'lane-c', height: 28, markerY: 14 }),
      row({ id: 'b-step', groupId: 'lane-b', height: 28, markerY: 14 }),
      row({ id: 'a-child', groupId: 'stub-a', height: 28, markerY: 14 }),
      row({ id: 'a-step', groupId: 'lane-a', height: 28, markerY: 14 }),
      row({ id: 'a-header' }),
      row({ id: 'b-header' }),
      row({ id: 'c-header' }),
    ],
    groups: [
      group({ id: 'lane-a', originRowId: 'a-header', shape: 'open', identityIndex: 0 }),
      group({ id: 'lane-b', originRowId: 'b-header', shape: 'open', identityIndex: 1 }),
      group({ id: 'lane-c', originRowId: 'c-header', shape: 'open', identityIndex: 2 }),
      group({ id: 'stub-a', originRowId: 'a-step', parentGroupId: 'lane-a', identityIndex: 0 }),
    ],
  };

  const nested: Fixture = {
    rows: [
      row({ id: 'now', markerY: null, height: 48, topY: 12 }),
      row({ id: 'child-2', groupId: 'stub' }),
      row({ id: 'child-1', groupId: 'stub' }),
      row({ id: 'step-2', groupId: 'lane' }),
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
      row({ id: 'now', markerY: null, height: 48, topY: 12 }),
      row({
        id: 'cluster',
        groupId: 'lane',
        isPending: true,
        markerY: 24,
        topAnchorY: 8,
        height: 48,
      }),
      row({ id: 'running', groupId: 'lane' }),
      row({ id: 'done', groupId: 'lane' }),
      row({ id: 'origin' }),
    ],
    groups: [group({ id: 'lane', originRowId: 'origin', shape: 'open' })],
  };

  const fixtures: ReadonlyArray<Fixture> = [saturated, nested, dangling];

  it('widens the rail rather than sharing a lane when many runs are live at once', () => {
    const layout = layoutTimelineRail(saturated);

    expect(layout.columnByGroupId.get('lane-a')).toBe(1);
    expect(layout.columnByGroupId.get('lane-b')).toBe(2);
    expect(layout.columnByGroupId.get('lane-c')).toBe(3);
    expect(layout.columnByGroupId.get('stub-a')).toBe(4);
    expect(railRow(layout, 'a-child').markerColumn).toBe(1);
    expect(railRow(layout, 'a-child').joins.map((join) => join.laneColumn)).toEqual([4]);
  });

  it('never overlaps two strokes in the same lane column of a row', () => {
    for (const fixture of fixtures) {
      const layout = layoutTimelineRail(fixture);
      for (const rail of layout.rows) {
        const byColumn = new Map<number, RailSegment[]>();
        for (const segment of rail.segments) {
          byColumn.set(segment.column, [...(byColumn.get(segment.column) ?? []), segment]);
        }
        for (const segments of byColumn.values()) {
          const sorted = [...segments].sort((first, second) => first.fromY - second.fromY);
          for (const [index, segment] of sorted.entries()) {
            const previous = sorted[index - 1];
            if (previous !== undefined) {
              expect(segment.fromY).toBeGreaterThanOrEqual(previous.toY);
            }
          }
        }
      }
    }
  });

  it('keeps a junction row free of straight runs in the lane the curve owns', () => {
    for (const fixture of fixtures) {
      const layout = layoutTimelineRail(fixture);
      for (const rail of layout.rows) {
        for (const join of rail.joins) {
          expect(rail.segments.filter((segment) => segment.column === join.laneColumn)).toEqual([]);
        }
      }
    }
  });

  it('continues every lane that crosses a row edge into the neighbouring row', () => {
    for (const fixture of fixtures) {
      const layout = layoutTimelineRail(fixture);
      for (let index = 0; index < layout.rows.length - 1; index += 1) {
        const upper = layout.rows[index];
        const lower = layout.rows[index + 1];
        const lowerTopY = fixture.rows[index + 1]?.topY ?? 0;
        if (upper === undefined || lower === undefined) {
          continue;
        }
        const widest = Math.max(...layout.columnByGroupId.values());
        for (let column = 1; column <= widest; column += 1) {
          const bottomTouch =
            upper.segments.some(
              (segment) => segment.column === column && segment.toY === upper.height,
            ) || upper.joins.some((join) => join.kind === 'merge' && join.laneColumn === column);
          const topTouch =
            lower.segments.some(
              (segment) => segment.column === column && segment.fromY === lowerTopY,
            ) || lower.joins.some((join) => join.kind === 'depart' && join.laneColumn === column);
          expect(bottomTouch).toBe(topTouch);
        }
      }
    }
  });

  it('anchors every curve exactly on the marker and on the lane at the row edge', () => {
    for (const fixture of fixtures) {
      const layout = layoutTimelineRail(fixture);
      for (const rail of layout.rows) {
        for (const join of rail.joins) {
          const coordinates = cubicCoordinatesOf({ join });
          if (join.kind === 'depart') {
            expect(coordinates.startX).toBe(railColumnX({ column: join.spineColumn }));
            expect(coordinates.startY).toBe(join.anchorY);
            expect(coordinates.endX).toBe(railColumnX({ column: join.laneColumn }));
            expect(coordinates.endY).toBe(0);
            continue;
          }
          expect(coordinates.startX).toBe(railColumnX({ column: join.laneColumn }));
          expect(coordinates.startY).toBe(rail.height);
          expect(coordinates.endX).toBe(railColumnX({ column: join.spineColumn }));
          expect(coordinates.endY).toBe(join.anchorY);
        }
      }
    }
  });
});
