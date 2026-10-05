export const RAIL_SPINE_X = 8;
export const RAIL_LANE_OFFSET = 16;
const RAIL_EDGE_PAD = 8;
const RAIL_CURVE_HANDLE = 8.84;
export const RAIL_EDGE_BLEED = 1;

type RailDash = 'solid' | 'dashed';

export type RailGroupShape = 'open' | 'merged';

export type RailGroupDirection = 'up' | 'down';

export type RailGroupInput = {
  readonly id: string;
  readonly parentGroupId: string | null;
  readonly direction?: RailGroupDirection;
  readonly identityIndex: number | null;
  readonly isMuted: boolean;
  readonly originRowId: string;
  readonly shape: RailGroupShape;
};

export type RailRowInput = {
  readonly id: string;
  readonly height: number;
  readonly topY: number;
  readonly markerY: number | null;
  readonly groupId: string | null;
  readonly isPending: boolean;
};

export type RailSegment = {
  readonly column: number;
  readonly laneId: string | null;
  readonly identityIndex: number | null;
  readonly isMuted: boolean;
  readonly dash: RailDash;
  readonly fromY: number;
  readonly toY: number;
};

export type RailJoin = {
  readonly kind: 'branch' | 'fork';
  readonly spineColumn: number;
  readonly laneColumn: number;
  readonly laneId: string | null;
  readonly identityIndex: number | null;
  readonly isMuted: boolean;
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
  readonly hasSpine?: boolean;
};

type Interval = {
  readonly from: number;
  readonly to: number;
};

type GroupSpan = {
  readonly group: RailGroupInput;
  readonly originIndex: number;
  readonly topIndex: number;
  readonly memberIndexes: ReadonlyArray<number>;
  readonly isSelfOrigin: boolean;
  readonly isDown: boolean;
  readonly isOpen: boolean;
  readonly interval: Interval;
};

export const railColumnX = ({ column }: { readonly column: number }): number =>
  RAIL_SPINE_X + column * RAIL_LANE_OFFSET;

const anchorOf = ({ row }: { readonly row: RailRowInput }): number =>
  row.markerY ?? (row.topY + row.height) / 2;

type JoinPathParams = {
  readonly join: PlannedJoin;
  readonly rowHeight: number;
};

const joinPathOf = ({ join, rowHeight }: JoinPathParams): string => {
  const spineX = railColumnX({ column: join.spineColumn });
  const laneX = railColumnX({ column: join.laneColumn });
  const edgeY = join.dash === 'solid' ? -RAIL_EDGE_BLEED : 0;
  if (join.kind === 'fork') {
    const handle = Math.min(RAIL_CURVE_HANDLE, rowHeight - join.anchorY);
    return `M ${spineX} ${join.anchorY} C ${spineX + RAIL_CURVE_HANDLE} ${join.anchorY}, ${laneX} ${rowHeight - handle}, ${laneX} ${rowHeight}`;
  }
  return `M ${laneX} ${edgeY} L ${laneX} 0 C ${laneX} ${RAIL_CURVE_HANDLE}, ${spineX + RAIL_CURVE_HANDLE} ${join.anchorY}, ${spineX} ${join.anchorY}`;
};

const isSameInk = ({
  first,
  second,
}: {
  readonly first: RailSegment;
  readonly second: RailSegment;
}): boolean =>
  first.column === second.column &&
  first.laneId === second.laneId &&
  first.identityIndex === second.identityIndex &&
  first.isMuted === second.isMuted;

export const mergeRailSegments = ({
  segments,
}: {
  readonly segments: ReadonlyArray<RailSegment>;
}): ReadonlyArray<RailSegment> => {
  const ordered = [...segments].sort(
    (first, second) => first.column - second.column || first.fromY - second.fromY,
  );
  const merged: RailSegment[] = [];
  for (const segment of ordered) {
    const last = merged.at(-1);
    if (last === undefined || last.column !== segment.column || segment.fromY > last.toY) {
      merged.push(segment);
      continue;
    }
    if (last.dash === segment.dash && isSameInk({ first: last, second: segment })) {
      merged[merged.length - 1] = { ...last, toY: Math.max(last.toY, segment.toY) };
      continue;
    }
    if (last.dash === 'solid') {
      if (segment.toY > last.toY) {
        merged.push({ ...segment, fromY: last.toY });
      }
      continue;
    }
    const clipped = { ...last, toY: segment.fromY };
    merged.splice(merged.length - 1, 1, ...(clipped.toY > clipped.fromY ? [clipped] : []));
    merged.push(segment);
    if (last.toY > segment.toY) {
      merged.push({ ...last, fromY: segment.toY });
    }
  }
  return merged;
};

export type RailLaneSpan = {
  readonly laneId: string;
  readonly column: number;
  readonly identityIndex: number;
  readonly fromY: number;
  readonly toY: number;
};

export const railLaneSpans = ({
  rail,
}: {
  readonly rail: RailRow;
}): ReadonlyArray<RailLaneSpan> => {
  const spans = new Map<string, RailLaneSpan>();
  for (const segment of rail.segments) {
    if (segment.laneId === null || segment.identityIndex === null) {
      continue;
    }
    const key = `${segment.laneId}:${segment.column}`;
    const known = spans.get(key);
    spans.set(key, {
      laneId: segment.laneId,
      column: segment.column,
      identityIndex: segment.identityIndex,
      fromY: known === undefined ? segment.fromY : Math.min(known.fromY, segment.fromY),
      toY: known === undefined ? segment.toY : Math.max(known.toY, segment.toY),
    });
  }
  return [...spans.values()];
};

const overlaps = ({ first, second }: { readonly first: Interval; readonly second: Interval }) =>
  first.from <= second.to && second.from <= first.to;

export const layoutTimelineRail = ({ rows, groups, hasSpine = true }: Params): RailLayout => {
  const rootParentColumn = hasSpine ? 0 : -1;
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
  const parentOf = ({ group }: { readonly group: RailGroupInput }): RailGroupInput | null =>
    group.parentGroupId == null ? null : (groupById.get(group.parentGroupId) ?? null);

  const depthOf = ({ group }: { readonly group: RailGroupInput }): number => {
    let depth = 0;
    let current = parentOf({ group });
    while (current !== null && depth < groups.length) {
      depth += 1;
      current = parentOf({ group: current });
    }
    return depth;
  };

  const rootOf = ({ group }: { readonly group: RailGroupInput }): RailGroupInput => {
    let current = group;
    let hops = 0;
    let parent = parentOf({ group: current });
    while (parent !== null && hops < groups.length) {
      current = parent;
      parent = parentOf({ group: current });
      hops += 1;
    }
    return current;
  };

  const lastIndex = Math.max(0, rows.length - 1);
  const drafts: ReadonlyArray<Omit<GroupSpan, 'interval'>> = groups.flatMap((group) => {
    const originIndex = indexById.get(group.originRowId) ?? lastIndex;
    const isSelfOrigin = rows[originIndex]?.groupId === group.id;
    const isDown = group.direction === 'down';
    const isOpen = group.shape === 'open' && !isDown;
    const memberIndexes = (membersByGroupId.get(group.id) ?? []).filter((index) =>
      isDown ? index > originIndex : index < originIndex,
    );
    const topIndex = isDown
      ? memberIndexes.length > 0
        ? originIndex
        : undefined
      : (memberIndexes[0] ?? (isSelfOrigin ? originIndex : undefined));
    if (topIndex === undefined) {
      return [];
    }
    return [{ group, originIndex, topIndex, memberIndexes, isSelfOrigin, isDown, isOpen }];
  });
  const spans: ReadonlyArray<GroupSpan> = drafts.map((draft) => ({
    ...draft,
    interval: draft.isDown
      ? { from: draft.originIndex, to: draft.memberIndexes.at(-1) ?? draft.originIndex }
      : { from: draft.isOpen ? 0 : draft.topIndex, to: draft.originIndex },
  }));

  const columnByGroupId = new Map<string, number>();
  const placed: Array<{ readonly column: number; readonly interval: Interval }> = [];
  const ordered = [...spans].sort(
    (first, second) =>
      depthOf({ group: first.group }) - depthOf({ group: second.group }) ||
      first.interval.from - second.interval.from ||
      first.topIndex - second.topIndex ||
      first.group.id.localeCompare(second.group.id),
  );
  for (const span of ordered) {
    const parentId = span.group.parentGroupId;
    const parentColumn =
      parentId == null ? rootParentColumn : (columnByGroupId.get(parentId) ?? rootParentColumn);
    let column = parentColumn + 1;
    while (
      placed.some(
        (other) =>
          other.column === column && overlaps({ first: other.interval, second: span.interval }),
      )
    ) {
      column += 1;
    }
    columnByGroupId.set(span.group.id, column);
    placed.push({ column, interval: span.interval });
  }

  const laneSegmentsByIndex: RailSegment[][] = rows.map(() => []);
  const joinsByIndex: PlannedJoin[][] = rows.map(() => []);

  for (const span of spans) {
    const { group, originIndex, memberIndexes, isSelfOrigin } = span;
    const column = columnByGroupId.get(group.id) ?? rootParentColumn + 1;
    const parentId = group.parentGroupId;
    const parentColumn =
      parentId == null ? rootParentColumn : (columnByGroupId.get(parentId) ?? rootParentColumn);
    const root = rootOf({ group });
    const ink = {
      column,
      laneId: root.id,
      identityIndex: root.identityIndex,
      isMuted: root.isMuted,
    };
    if (span.isDown) {
      const downChain = [originIndex, ...memberIndexes];
      for (const [step, upper] of downChain.entries()) {
        const lower = downChain[step + 1];
        const upperRow = rows[upper];
        const lowerRow = lower === undefined ? undefined : rows[lower];
        if (lower === undefined || upperRow === undefined || lowerRow === undefined) {
          continue;
        }
        const dash: RailDash = lowerRow.isPending ? 'dashed' : 'solid';
        if (upper !== originIndex || span.isSelfOrigin) {
          laneSegmentsByIndex[upper]?.push({
            ...ink,
            dash,
            fromY: anchorOf({ row: upperRow }),
            toY: upperRow.height,
          });
        }
        for (let index = upper + 1; index < lower; index += 1) {
          const row = rows[index];
          if (row === undefined) {
            continue;
          }
          laneSegmentsByIndex[index]?.push({ ...ink, dash, fromY: row.topY, toY: row.height });
        }
        laneSegmentsByIndex[lower]?.push({
          ...ink,
          dash,
          fromY: lowerRow.topY,
          toY: anchorOf({ row: lowerRow }),
        });
      }
      const originRow = rows[originIndex];
      const firstRow = rows[memberIndexes[0] ?? originIndex];
      if (originRow !== undefined && firstRow !== undefined && !span.isSelfOrigin) {
        joinsByIndex[originIndex]?.push({
          kind: 'fork',
          spineColumn: parentColumn,
          laneColumn: column,
          laneId: root.id,
          identityIndex: root.identityIndex,
          isMuted: root.isMuted,
          dash: firstRow.isPending ? 'dashed' : 'solid',
          anchorY: anchorOf({ row: originRow }),
        });
      }
      continue;
    }
    const chain = [originIndex, ...[...memberIndexes].reverse()];

    for (const [step, lower] of chain.entries()) {
      const upper = chain[step + 1];
      const lowerRow = rows[lower];
      const upperRow = upper === undefined ? undefined : rows[upper];
      if (upper === undefined || lowerRow === undefined || upperRow === undefined) {
        continue;
      }
      const dash: RailDash = upperRow.isPending ? 'dashed' : 'solid';
      laneSegmentsByIndex[upper]?.push({
        ...ink,
        dash,
        fromY: anchorOf({ row: upperRow }),
        toY: upperRow.height,
      });
      for (let index = upper + 1; index < lower; index += 1) {
        const row = rows[index];
        if (row === undefined) {
          continue;
        }
        laneSegmentsByIndex[index]?.push({ ...ink, dash, fromY: row.topY, toY: row.height });
      }
      if (lower !== originIndex) {
        laneSegmentsByIndex[lower]?.push({
          ...ink,
          dash,
          fromY: lowerRow.topY,
          toY: anchorOf({ row: lowerRow }),
        });
      }
    }

    const originRow = rows[originIndex];
    const nearestIndex = memberIndexes[memberIndexes.length - 1];
    const nearestRow = nearestIndex === undefined ? undefined : rows[nearestIndex];
    if (originRow !== undefined && nearestRow !== undefined && isSelfOrigin) {
      laneSegmentsByIndex[originIndex]?.push({
        ...ink,
        dash: nearestRow.isPending ? 'dashed' : 'solid',
        fromY: originRow.topY,
        toY: anchorOf({ row: originRow }),
      });
    }
    if (originRow !== undefined && nearestRow !== undefined && !isSelfOrigin) {
      joinsByIndex[originIndex]?.push({
        kind: 'branch',
        spineColumn: parentColumn,
        laneColumn: column,
        laneId: root.id,
        identityIndex: root.identityIndex,
        isMuted: root.isMuted,
        dash: nearestRow.isPending ? 'dashed' : 'solid',
        anchorY: anchorOf({ row: originRow }),
      });
    }
    const { topIndex } = span;
    const topRow = rows[topIndex];
    if (!span.isOpen || topRow === undefined) {
      continue;
    }
    laneSegmentsByIndex[topIndex]?.push({
      ...ink,
      dash: 'dashed',
      fromY: topRow.topY,
      toY: anchorOf({ row: topRow }),
    });
    for (let index = 0; index < topIndex; index += 1) {
      const row = rows[index];
      if (row === undefined) {
        continue;
      }
      laneSegmentsByIndex[index]?.push({
        ...ink,
        dash: 'dashed',
        fromY: row.topY,
        toY: row.height,
      });
    }
  }

  const maxColumn = [...columnByGroupId.values()].reduce(
    (widest, column) => (column > widest ? column : widest),
    0,
  );

  return {
    width: RAIL_SPINE_X + maxColumn * RAIL_LANE_OFFSET + RAIL_EDGE_PAD,
    columnByGroupId,
    rows: rows.map((row, index) => ({
      id: row.id,
      height: row.height,
      segments: mergeRailSegments({
        segments: [
          ...(hasSpine
            ? [
                {
                  column: 0,
                  laneId: null,
                  identityIndex: null,
                  isMuted: false,
                  dash: 'solid',
                  fromY: row.topY,
                  toY: row.height,
                } satisfies RailSegment,
              ]
            : []),
          ...(laneSegmentsByIndex[index] ?? []),
        ],
      }),
      joins: (joinsByIndex[index] ?? []).map((join) => ({
        ...join,
        path: joinPathOf({ join, rowHeight: row.height }),
      })),
      markerColumn: row.groupId == null ? 0 : (columnByGroupId.get(row.groupId) ?? 0),
      markerY: row.markerY,
    })),
  };
};
