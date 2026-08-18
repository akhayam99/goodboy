export const RAIL_SPINE_X = 8;
export const RAIL_LANE_OFFSET = 16;
const RAIL_EDGE_PAD = 8;
const RAIL_CURVE_K = 0.5523;
const RAIL_CURVE_HANDLE = 8.84;

type RailDash = 'solid' | 'dashed';

export type RailGroupShape = 'open' | 'merged';

export type RailGroupInput = {
  readonly id: string;
  readonly parentGroupId: string | null;
  readonly identityIndex: number | null;
  readonly originRowId: string;
  readonly shape: RailGroupShape;
};

export type RailRowInput = {
  readonly id: string;
  readonly height: number;
  readonly topY: number;
  readonly markerY: number | null;
  readonly topAnchorY: number | null;
  readonly groupId: string | null;
  readonly isPending: boolean;
};

export type RailSegment = {
  readonly column: number;
  readonly identityIndex: number | null;
  readonly dash: RailDash;
  readonly fromY: number;
  readonly toY: number;
};

export type RailJoin = {
  readonly kind: 'depart' | 'merge';
  readonly spineColumn: number;
  readonly laneColumn: number;
  readonly identityIndex: number | null;
  readonly dash: RailDash;
  readonly anchorY: number;
  readonly path: string;
};

type PlannedJoin = Omit<RailJoin, 'path'>;

export type RailRow = {
  readonly id: string;
  readonly height: number;
  readonly segments: ReadonlyArray<RailSegment>;
  readonly joins: ReadonlyArray<RailJoin>;
  readonly markerColumn: number;
  readonly markerY: number | null;
};

export type RailLayout = {
  readonly width: number;
  readonly rows: ReadonlyArray<RailRow>;
  readonly columnByGroupId: ReadonlyMap<string, number>;
};

type Params = {
  readonly rows: ReadonlyArray<RailRowInput>;
  readonly groups: ReadonlyArray<RailGroupInput>;
};

type GroupPlan = {
  readonly group: RailGroupInput;
  readonly column: number;
  readonly memberIndexes: ReadonlyArray<number>;
  readonly originIndex: number;
  readonly boundaryIndex: number;
  readonly hasFuture: boolean;
};

type Interval = {
  readonly from: number;
  readonly to: number;
};

export const railColumnX = ({ column }: { readonly column: number }): number =>
  RAIL_SPINE_X + column * RAIL_LANE_OFFSET;

const anchorOf = ({ row }: { readonly row: RailRowInput }): number =>
  row.markerY ?? (row.topY + row.height) / 2;

const topAnchorOf = ({ row }: { readonly row: RailRowInput }): number =>
  row.topAnchorY ?? anchorOf({ row });

type JoinPathParams = {
  readonly join: PlannedJoin;
  readonly height: number;
};

const joinPathOf = ({ join, height }: JoinPathParams): string => {
  const spineX = railColumnX({ column: join.spineColumn });
  const laneX = railColumnX({ column: join.laneColumn });
  if (join.kind === 'depart') {
    return `M ${spineX} ${join.anchorY} C ${spineX + RAIL_CURVE_HANDLE} ${join.anchorY}, ${laneX} ${RAIL_CURVE_K * join.anchorY}, ${laneX} 0`;
  }
  return `M ${laneX} ${height} C ${laneX} ${height - RAIL_CURVE_HANDLE}, ${spineX + RAIL_CURVE_HANDLE} ${join.anchorY}, ${spineX} ${join.anchorY}`;
};

const overlaps = ({ first, second }: { readonly first: Interval; readonly second: Interval }) =>
  first.from <= second.to && second.from <= first.to;

export const layoutTimelineRail = ({ rows, groups }: Params): RailLayout => {
  const indexById = new Map<string, number>();
  const membersByGroupId = new Map<string, number[]>();
  for (const [index, row] of rows.entries()) {
    indexById.set(row.id, index);
    if (row.groupId == null) {
      continue;
    }
    const members = membersByGroupId.get(row.groupId) ?? [];
    members.push(index);
    membersByGroupId.set(row.groupId, members);
  }

  const groupById = new Map(groups.map((group) => [group.id, group]));
  const depthOf = ({ group }: { readonly group: RailGroupInput }): number => {
    let depth = 0;
    let parentId = group.parentGroupId;
    while (parentId != null && depth <= groups.length) {
      depth += 1;
      parentId = groupById.get(parentId)?.parentGroupId ?? null;
    }
    return depth;
  };

  const lastIndex = Math.max(0, rows.length - 1);
  const intervalOf = ({ group }: { readonly group: RailGroupInput }): Interval => {
    const members = membersByGroupId.get(group.id) ?? [];
    const originIndex = indexById.get(group.originRowId) ?? lastIndex;
    const first = members[0];
    if (first === undefined) {
      return { from: originIndex, to: originIndex };
    }
    return { from: group.shape === 'open' ? 0 : first, to: originIndex };
  };

  const ordered = [...groups].sort(
    (first, second) =>
      depthOf({ group: first }) - depthOf({ group: second }) ||
      intervalOf({ group: first }).from - intervalOf({ group: second }).from ||
      first.id.localeCompare(second.id),
  );

  const columnByGroupId = new Map<string, number>();
  const takenByColumn = new Map<number, Interval[]>();
  for (const group of ordered) {
    const interval = intervalOf({ group });
    const parentColumn =
      group.parentGroupId == null ? 0 : (columnByGroupId.get(group.parentGroupId) ?? 0);
    let column = parentColumn + 1;
    while (
      (takenByColumn.get(column) ?? []).some((taken) =>
        overlaps({ first: taken, second: interval }),
      )
    ) {
      column += 1;
    }
    columnByGroupId.set(group.id, column);
    takenByColumn.set(column, [...(takenByColumn.get(column) ?? []), interval]);
  }

  const plans: ReadonlyArray<GroupPlan> = ordered.map((group) => {
    const memberIndexes = membersByGroupId.get(group.id) ?? [];
    const settled = memberIndexes.filter((index) => rows[index]?.isPending !== true);
    const originIndex = indexById.get(group.originRowId) ?? lastIndex;
    const boundaryIndex = settled[0] ?? originIndex;
    return {
      group,
      column: columnByGroupId.get(group.id) ?? 1,
      memberIndexes,
      originIndex,
      boundaryIndex,
      hasFuture:
        group.shape === 'open' || memberIndexes.some((index) => rows[index]?.isPending === true),
    };
  });

  const laneSegmentsByIndex: RailSegment[][] = rows.map(() => []);
  const joinsByIndex: PlannedJoin[][] = rows.map(() => []);

  const pushSpan = ({ index, plan }: { readonly index: number; readonly plan: GroupPlan }) => {
    const row = rows[index];
    if (row === undefined) {
      return;
    }
    const shared = { column: plan.column, identityIndex: plan.group.identityIndex };
    if (index > plan.boundaryIndex) {
      laneSegmentsByIndex[index]?.push({
        ...shared,
        dash: 'solid',
        fromY: row.topY,
        toY: row.height,
      });
      return;
    }
    if (index < plan.boundaryIndex) {
      laneSegmentsByIndex[index]?.push({
        ...shared,
        dash: 'dashed',
        fromY: row.topY,
        toY: row.height,
      });
      return;
    }
    const anchor = anchorOf({ row });
    laneSegmentsByIndex[index]?.push({ ...shared, dash: 'solid', fromY: anchor, toY: row.height });
    laneSegmentsByIndex[index]?.push({
      ...shared,
      dash: plan.hasFuture ? 'dashed' : 'solid',
      fromY: row.topY,
      toY: anchor,
    });
  };

  for (const plan of plans) {
    const parentColumn =
      plan.group.parentGroupId == null ? 0 : (columnByGroupId.get(plan.group.parentGroupId) ?? 0);
    const first = plan.memberIndexes[0];
    const topIndex = first !== undefined && first < plan.originIndex ? first : undefined;
    const originRow = rows[plan.originIndex];

    if (topIndex === undefined) {
      continue;
    }

    for (let index = topIndex + 1; index < plan.originIndex; index += 1) {
      pushSpan({ index, plan });
    }

    if (originRow !== undefined) {
      joinsByIndex[plan.originIndex]?.push({
        kind: 'depart',
        spineColumn: parentColumn,
        laneColumn: plan.column,
        identityIndex: plan.group.identityIndex,
        dash: plan.boundaryIndex === plan.originIndex ? 'dashed' : 'solid',
        anchorY: anchorOf({ row: originRow }),
      });
    }

    const topRow = rows[topIndex];
    if (topRow === undefined) {
      continue;
    }
    const topAnchor = topAnchorOf({ row: topRow });
    const shared = { column: plan.column, identityIndex: plan.group.identityIndex };
    const isTopPending = topIndex < plan.boundaryIndex;

    if (plan.group.shape === 'open' && !isTopPending) {
      laneSegmentsByIndex[topIndex]?.push({
        ...shared,
        dash: 'solid',
        fromY: topAnchor,
        toY: topRow.height,
      });
      laneSegmentsByIndex[topIndex]?.push({
        ...shared,
        dash: 'dashed',
        fromY: topRow.topY,
        toY: topAnchor,
      });
      for (let index = 0; index < topIndex; index += 1) {
        const row = rows[index];
        if (row === undefined) {
          continue;
        }
        laneSegmentsByIndex[index]?.push({
          ...shared,
          dash: 'dashed',
          fromY: row.topY,
          toY: row.height,
        });
      }
      continue;
    }

    joinsByIndex[topIndex]?.push({
      kind: 'merge',
      spineColumn: parentColumn,
      laneColumn: plan.column,
      identityIndex: plan.group.identityIndex,
      dash: isTopPending ? 'dashed' : 'solid',
      anchorY: anchorOf({ row: topRow }),
    });
  }

  const normalizedRows = rows.map((row, index) => {
    const ownColumn = row.groupId == null ? 0 : (columnByGroupId.get(row.groupId) ?? 0);
    const plannedJoins = joinsByIndex[index] ?? [];
    const ownMerge = plannedJoins.find(
      (join) => join.kind === 'merge' && join.laneColumn === ownColumn,
    );
    const markerColumn = ownMerge?.spineColumn ?? ownColumn;
    const joins = plannedJoins.map((join) =>
      join.kind === 'depart' && ownMerge !== undefined
        ? { ...join, spineColumn: markerColumn }
        : join,
    );
    return { joins, markerColumn };
  });
  const maxColumn = [...columnByGroupId.values()].reduce((widest, column) => {
    return column > widest ? column : widest;
  }, 0);

  return {
    width: RAIL_SPINE_X + maxColumn * RAIL_LANE_OFFSET + RAIL_EDGE_PAD,
    columnByGroupId,
    rows: rows.map((row, index) => {
      const markerColumn = normalizedRows[index]?.markerColumn ?? 0;
      const normalizedJoins = normalizedRows[index]?.joins ?? [];
      const segments = [
        {
          column: 0,
          identityIndex: null,
          dash: 'solid',
          fromY: row.topY,
          toY: row.height,
        } satisfies RailSegment,
        ...(laneSegmentsByIndex[index] ?? []),
      ];
      const joins = normalizedJoins.map((join) => ({
        ...join,
        path: joinPathOf({ join, height: row.height }),
      }));
      return {
        id: row.id,
        height: row.height,
        segments,
        joins,
        markerColumn,
        markerY: row.markerY,
      };
    }),
  };
};
