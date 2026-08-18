import { describe, expect, it } from 'vitest';
import {
  RAIL_LANE_OFFSET,
  RAIL_MAX_COLUMN,
  RAIL_SPINE_X,
  layoutTimelineRail,
  railColumnX,
  type RailGroupInput,
  type RailGroupShape,
  type RailRowInput,
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
        strength: 'full',
      },
    ]);
    expect(railRow(layout, 'origin').markerColumn).toBe(0);
    expect(railRow(layout, 'step-1').markerColumn).toBe(1);
    expect(railRow(layout, 'step-2').markerColumn).toBe(1);
  });

  it('merges a finished run back into the spine at its newest row', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'step-1', groupId: 'lane' }), row({ id: 'origin' })],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'merged' })],
    });

    expect(railRow(layout, 'step-1').joins.map((join) => join.kind)).toEqual(['merge']);
    expect(lanesOf(layout, 'step-1')).toEqual([
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 18, toY: 36 },
    ]);
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
      { column: 1, identityIndex: 0, dash: 'dashed', strength: 'full', fromY: 0, toY: 36 },
    ]);
    expect(lanesOf(layout, 'now')).toEqual([
      { column: 1, identityIndex: 0, dash: 'dashed', strength: 'full', fromY: 12, toY: 48 },
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
        strength: 'full',
      },
    ]);
    expect(lanesOf(layout, 'pending')).toEqual([
      { column: 1, identityIndex: 0, dash: 'dashed', strength: 'full', fromY: 18, toY: 36 },
    ]);
    expect(lanesOf(layout, 'now')).toEqual([]);
  });

  it('anchors the merge on the first line of a compressed pending stretch', () => {
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

    expect(railRow(layout, 'cluster').joins.map((join) => join.anchorY)).toEqual([8]);
    expect(lanesOf(layout, 'cluster')).toEqual([
      { column: 1, identityIndex: 0, dash: 'dashed', strength: 'full', fromY: 8, toY: 48 },
    ]);
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
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 0, toY: 36 },
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
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 0, toY: 48 },
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 0, toY: 48 },
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
    expect(railRow(layout, 'child-1').markerColumn).toBe(2);
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

    expect(lanesOf(layout, 'pending-2').map((segment) => segment.dash)).toEqual(['dashed']);
    expect(lanesOf(layout, 'running')).toEqual([
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 18, toY: 36 },
      { column: 1, identityIndex: 0, dash: 'dashed', strength: 'full', fromY: 0, toY: 18 },
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

  it('dims the spine from a branch departing to the same branch merging back', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'newer' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
        row({ id: 'older' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(spineOf(layout, 'newer')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'full', fromY: 0, toY: 36 },
    ]);
    expect(spineOf(layout, 'step-1')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'full', fromY: 0, toY: 18 },
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 18, toY: 36 },
    ]);
    expect(spineOf(layout, 'origin')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 0, toY: 18 },
      { column: 0, identityIndex: null, dash: 'solid', strength: 'full', fromY: 18, toY: 36 },
    ]);
    expect(spineOf(layout, 'older')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'full', fromY: 0, toY: 36 },
    ]);
  });

  it('dims the spine through every row an interrupted branch runs beside', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-2', groupId: 'lane' }),
        row({ id: 'standalone' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(spineOf(layout, 'standalone')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 0, toY: 36 },
    ]);
    expect(spineOf(layout, 'step-1')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 0, toY: 36 },
    ]);
  });

  it('dims the spine once where two branches are live over the same rows', () => {
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

    expect(spineOf(layout, 'a-step')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 0, toY: 36 },
    ]);
    expect(spineOf(layout, 'b-origin')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 0, toY: 36 },
    ]);
    expect([...lanesOf(layout, 'a-step')].map((segment) => segment.column).sort()).toEqual([1, 2]);
  });

  it('dims the spine under a fan-out that hangs off a lane rather than off the spine', () => {
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

    expect(spineOf(layout, 'child-1')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'full', fromY: 0, toY: 18 },
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 18, toY: 36 },
    ]);
    expect(spineOf(layout, 'step-1')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 0, toY: 36 },
    ]);
  });

  it('dims the run lane the fan-out runs beside and leaves the fan-out at full strength', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-2', groupId: 'lane' }),
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

    expect(lanesOf(layout, 'child-1')).toEqual([
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'receded', fromY: 0, toY: 36 },
      { column: 2, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 0, toY: 36 },
    ]);
    expect(lanesOf(layout, 'child-2')).toEqual([
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 0, toY: 18 },
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'receded', fromY: 18, toY: 36 },
      { column: 2, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 18, toY: 36 },
    ]);
    expect(lanesOf(layout, 'step-2')).toEqual([
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 18, toY: 36 },
    ]);
  });

  it('dims a lane above the point its fan-out departs and leaves it full below', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'step-2', groupId: 'lane' }),
        row({ id: 'child-1', groupId: 'stub' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [
        group({ id: 'lane', originRowId: 'origin' }),
        group({ id: 'stub', originRowId: 'step-1', parentGroupId: 'lane' }),
      ],
    });

    expect(lanesOf(layout, 'step-1').filter((segment) => segment.column === 1)).toEqual([
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'receded', fromY: 0, toY: 18 },
      { column: 1, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 18, toY: 36 },
    ]);
  });

  it('draws a lane dashed and dimmed at once when its future is handed to a live child', () => {
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
      { column: 1, identityIndex: 0, dash: 'dashed', strength: 'full', fromY: 0, toY: 18 },
      { column: 1, identityIndex: 0, dash: 'dashed', strength: 'receded', fromY: 18, toY: 36 },
      { column: 2, identityIndex: 0, dash: 'solid', strength: 'full', fromY: 18, toY: 36 },
    ]);
  });

  it('dims the spine to the head of the feed while an open run dangles toward NOW', () => {
    const layout = layoutTimelineRail({
      rows: [
        row({ id: 'now', markerY: null, height: 48, topY: 12 }),
        row({ id: 'newer-entry' }),
        row({ id: 'step-1', groupId: 'lane' }),
        row({ id: 'origin' }),
      ],
      groups: [group({ id: 'lane', originRowId: 'origin', shape: 'open' })],
    });

    expect(spineOf(layout, 'now')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 12, toY: 48 },
    ]);
    expect(spineOf(layout, 'newer-entry')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 0, toY: 36 },
    ]);
    expect(spineOf(layout, 'origin')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'receded', fromY: 0, toY: 18 },
      { column: 0, identityIndex: null, dash: 'solid', strength: 'full', fromY: 18, toY: 36 },
    ]);
  });

  it('leaves the spine at full strength on a run that never leaves it', () => {
    const layout = layoutTimelineRail({
      rows: [row({ id: 'origin' })],
      groups: [group({ id: 'lane', originRowId: 'origin' })],
    });

    expect(spineOf(layout, 'origin')).toEqual([
      { column: 0, identityIndex: null, dash: 'solid', strength: 'full', fromY: 0, toY: 36 },
    ]);
  });

  it('never puts a lane past the column cap however deep the nesting goes', () => {
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

    for (const column of layout.columnByGroupId.values()) {
      expect(column).toBeLessThanOrEqual(RAIL_MAX_COLUMN);
    }
    expect(layout.width).toBe(RAIL_SPINE_X + RAIL_MAX_COLUMN * RAIL_LANE_OFFSET + 8);
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

    expect(lanesOf(layout, 'child').map((segment) => segment.identityIndex)).toEqual([null]);
    expect(railRow(layout, 'standalone-agent').joins.map((join) => join.identityIndex)).toEqual([
      null,
    ]);
  });

  it('places lane columns one offset apart from the spine', () => {
    expect(railColumnX({ column: 0 })).toBe(RAIL_SPINE_X);
    expect(railColumnX({ column: 2 })).toBe(RAIL_SPINE_X + 2 * RAIL_LANE_OFFSET);
  });
});

describe('a receded span carries its curves', () => {
  it('recedes the joins that sit inside a delegated stretch', () => {
    const layout = layoutTimelineRail({
      rows: [
        { id: 'child-top', height: 32, topY: 0, markerY: 16, topAnchorY: null, groupId: 'child', isPending: false },
        { id: 'child-bottom', height: 32, topY: 0, markerY: 16, topAnchorY: null, groupId: 'child', isPending: false },
        { id: 'parent-origin', height: 32, topY: 0, markerY: 16, topAnchorY: null, groupId: 'parent', isPending: false },
      ],
      groups: [
        { id: 'parent', parentGroupId: null, identityIndex: 0, originRowId: 'parent-origin', shape: 'merged' },
        { id: 'child', parentGroupId: 'parent', identityIndex: 1, originRowId: 'child-bottom', shape: 'merged' },
      ],
    });

    for (const row of layout.rows) {
      for (const join of row.joins) {
        const receded = row.segments.filter(
          (segment) => segment.column === join.laneColumn && segment.strength === 'receded',
        );
        const covers = receded.some(
          (segment) => segment.fromY <= join.anchorY && segment.toY >= join.anchorY,
        );
        if (covers) {
          expect(join.strength).toBe('receded');
        }
      }
    }
  });
});
