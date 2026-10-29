import {
  layoutTimelineRail,
  railColumnX,
  type RailGroupInput,
  type RailRow,
  type RailRowInput,
} from '../../../../features/workTreeModel/railGeometry';

export const GROUP_ROW_HEIGHT = 32;
export const STEP_ROW_HEIGHT = 28;

const RAIL_EDGE_PAD = 8;
const MIN_COLUMNS = 1;

export type DemoRailNode = {
  readonly id: string;
  readonly laneOf: string | null;
  readonly isPending: boolean;
};

export type DemoRail = {
  readonly width: number;
  readonly railById: ReadonlyMap<string, RailRow>;
};

type Params = {
  readonly nodes: ReadonlyArray<DemoRailNode>;
};

type LaneParams = {
  readonly groupId: string;
};

const laneIdOf = ({ groupId }: LaneParams): string => `lane:${groupId}`;

export const demoRailOf = ({ nodes }: Params): DemoRail => {
  const rows = nodes.map((node): RailRowInput => {
    const height = node.laneOf === null ? GROUP_ROW_HEIGHT : STEP_ROW_HEIGHT;
    return {
      id: node.id,
      height,
      topY: 0,
      markerY: height / 2,
      groupId: node.laneOf === null ? null : laneIdOf({ groupId: node.laneOf }),
      isPending: node.isPending,
    };
  });
  const lanes = [...new Set(nodes.flatMap((node) => (node.laneOf === null ? [] : [node.laneOf])))];
  const groups = lanes.map((groupId): RailGroupInput => ({
    id: laneIdOf({ groupId }),
    parentGroupId: null,
    direction: 'down',
    identityIndex: null,
    isMuted: false,
    originRowId: groupId,
    shape: 'merged',
  }));
  const layout = layoutTimelineRail({ rows, groups });
  return {
    width: Math.max(layout.width, railColumnX({ column: MIN_COLUMNS }) + RAIL_EDGE_PAD),
    railById: new Map(layout.rows.map((row) => [row.id, row])),
  };
};
