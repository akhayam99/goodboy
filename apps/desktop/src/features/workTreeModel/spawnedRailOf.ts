import {
  layoutTimelineRail,
  railColumnX,
  type RailGroupInput,
  type RailInk,
  type RailRow,
  type RailRowInput,
} from './railGeometry';
import { parentIdsOf } from './parentIdsOf';

type SpawnedRailNode = Readonly<{
  id: string;
  level: number;
  isPending: boolean;
}>;

export type SpawnedRail = Readonly<{
  width: number;
  railById: ReadonlyMap<string, RailRow>;
  tailById: ReadonlyMap<string, ReadonlyArray<RailInk>>;
}>;

type Params = {
  readonly nodes: ReadonlyArray<SpawnedRailNode>;
};

type LaneParams = {
  readonly parentId: string | null;
};

type TailParams = {
  readonly row: RailRow;
};

const ROW_HEIGHT = 28;
const RAIL_EDGE_PAD = 8;
const MIN_COLUMNS = 1;

const laneIdOf = ({ parentId }: LaneParams): string | null =>
  parentId === null ? null : `lane:${parentId}`;

const tailOf = ({ row }: TailParams): ReadonlyArray<RailInk> => {
  const inks: ReadonlyArray<RailInk> = [
    ...row.segments.filter((segment) => segment.toY >= row.height),
    ...row.joins
      .filter((join) => join.kind === 'fork')
      .map((join) => ({ ...join, column: join.laneColumn })),
  ].map(({ column, laneId, identityIndex, isMuted, dash }) => ({
    column,
    laneId,
    identityIndex,
    isMuted,
    dash,
  }));
  return inks.filter(
    (ink, index) => inks.findIndex((other) => other.column === ink.column) === index,
  );
};

export const spawnedRailOf = ({ nodes }: Params): SpawnedRail => {
  const parentById = parentIdsOf({ nodes });
  const rows = nodes.map((node): RailRowInput => ({
    id: node.id,
    height: ROW_HEIGHT,
    topY: 0,
    markerY: ROW_HEIGHT / 2,
    groupId: laneIdOf({ parentId: parentById.get(node.id) ?? null }),
    isPending: node.isPending,
  }));
  const parents = new Set(
    [...parentById.values()].flatMap((parentId) => (parentId === null ? [] : [parentId])),
  );
  const groups = [...parents].map((parentId): RailGroupInput => ({
    id: `lane:${parentId}`,
    parentGroupId: laneIdOf({ parentId: parentById.get(parentId) ?? null }),
    direction: 'down',
    identityIndex: null,
    isMuted: false,
    originRowId: parentId,
    shape: 'merged',
  }));
  const layout = layoutTimelineRail({ rows, groups });
  return {
    width: Math.max(layout.width, railColumnX({ column: MIN_COLUMNS }) + RAIL_EDGE_PAD),
    railById: new Map(layout.rows.map((row) => [row.id, row])),
    tailById: new Map(layout.rows.map((row) => [row.id, tailOf({ row })])),
  };
};
