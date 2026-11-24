import { describe, expect, it } from 'vitest';
import { railColumnX } from './railGeometry';
import { spawnedRailOf } from './spawnedRailOf';

const NODES = [
  { id: 'root', level: 1, isPending: false },
  { id: 'planner', level: 2, isPending: false },
  { id: 'implementer', level: 2, isPending: false },
  { id: 'scout', level: 3, isPending: false },
  { id: 'tester', level: 2, isPending: true },
];

type TailParams = {
  readonly id: string;
};

describe('spawnedRailOf', () => {
  it('puts the root on the spine and every child on the lane of its parent', () => {
    const rail = spawnedRailOf({ nodes: NODES });

    expect(rail.railById.get('root')?.markerColumn).toBe(0);
    expect(rail.railById.get('planner')?.markerColumn).toBe(1);
    expect(rail.railById.get('tester')?.markerColumn).toBe(1);
    expect(rail.railById.get('scout')?.markerColumn).toBe(2);
    expect(rail.width).toBeGreaterThanOrEqual(railColumnX({ column: 2 }));
  });

  it('joins each parent row to the lane of its children, as Activity does', () => {
    const rail = spawnedRailOf({ nodes: NODES });

    expect(rail.railById.get('root')?.joins.map((join) => [join.kind, join.laneColumn])).toEqual([
      ['fork', 1],
    ]);
    expect(
      rail.railById.get('implementer')?.joins.map((join) => [join.spineColumn, join.laneColumn]),
    ).toEqual([[1, 2]]);
    expect(rail.railById.get('planner')?.joins).toEqual([]);
  });

  it('runs the spine through every row and dashes the lane down to a queued child', () => {
    const rail = spawnedRailOf({ nodes: NODES });

    for (const node of NODES) {
      const spine = rail.railById.get(node.id)?.segments.filter((segment) => segment.column === 0);
      expect(spine?.length).toBeGreaterThan(0);
    }
    const lane = rail.railById
      .get('tester')
      ?.segments.filter((segment) => segment.column === 1)
      .map((segment) => segment.dash);
    expect(lane).toContain('dashed');
  });

  it('carries every lane that leaves a row down a tall row, the marker on its first line', () => {
    const rail = spawnedRailOf({ nodes: NODES });
    const tailColumns = ({ id }: TailParams) =>
      (rail.tailById.get(id) ?? [])
        .map((ink) => ink.column)
        .sort((first, second) => first - second);

    expect(tailColumns({ id: 'root' })).toEqual([0, 1]);
    expect(tailColumns({ id: 'planner' })).toEqual([0, 1]);
    expect(tailColumns({ id: 'implementer' })).toEqual([0, 1, 2]);
    expect(tailColumns({ id: 'scout' })).toEqual([0, 1]);
    expect(tailColumns({ id: 'tester' })).toEqual([0]);
    expect(rail.tailById.get('tester')?.map((ink) => ink.dash)).toEqual(['solid']);
    for (const node of NODES) {
      expect(rail.railById.get(node.id)?.markerY).toBe(14);
    }
  });

  it('keeps one lane of width for a tree with no children', () => {
    const flat = spawnedRailOf({ nodes: [{ id: 'root', level: 1, isPending: false }] });
    const nested = spawnedRailOf({ nodes: NODES.slice(0, 2) });

    expect(flat.width).toBe(nested.width);
  });
});
