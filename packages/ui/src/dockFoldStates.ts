import { laneOf } from './dockLaneOf';
import type { Lane, LanePane } from './dockLaneTypes';
import { SIZING_RANK } from './dockSizingRank';

type CellAt = {
  readonly column: number;
  readonly row: number;
};

type LanesParams = {
  readonly lanes: ReadonlyArray<Lane>;
};

type PaneParams = {
  readonly pane: LanePane;
};

type OrderParams = LanesParams & {
  readonly order: ReadonlyArray<string>;
};

type CellParams = LanesParams & {
  readonly at: CellAt;
};

const tabsOf = ({ pane }: PaneParams): ReadonlyArray<string> =>
  pane.tabs !== undefined && pane.tabs.length > 0 ? pane.tabs : [pane.id];

const keepRankOf = ({ order, pane }: OrderParams & PaneParams): number =>
  Math.max(...tabsOf({ pane }).map((id) => order.indexOf(id)));

const paneAt = ({ lanes, at }: CellParams): LanePane | null =>
  lanes[at.column]?.panes[at.row] ?? null;

const neighborsOf = ({ lanes, at }: CellParams): ReadonlyArray<CellAt> => {
  const sameColumn = (lanes[at.column]?.panes ?? [])
    .map((_, row) => ({ column: at.column, row }))
    .filter((cell) => cell.row !== at.row);
  if (sameColumn.length > 0) {
    return sameColumn;
  }
  return [at.column - 1, at.column + 1].flatMap((column) =>
    (lanes[column]?.panes ?? []).map((_, row) => ({ column, row })),
  );
};

type MergeParams = {
  readonly host: LanePane;
  readonly victim: LanePane;
};

const mergedPaneOf = ({ host, victim }: MergeParams): LanePane => {
  const lead = SIZING_RANK[victim.sizing] > SIZING_RANK[host.sizing] ? victim : host;
  return {
    ...host,
    sizing: lead.sizing,
    savedWidth: lead.savedWidth,
    rowMin: Math.max(host.rowMin ?? 0, victim.rowMin ?? 0),
    tabs: [...tabsOf({ pane: host }), ...tabsOf({ pane: victim })],
  };
};

type FoldIdParams = OrderParams & {
  readonly id: string;
};

const foldedIntoNeighborOf = ({ lanes, order, id }: FoldIdParams): ReadonlyArray<Lane> | null => {
  const column = lanes.findIndex((lane) => lane.panes.some((pane) => pane.id === id));
  const row = lanes[column]?.panes.findIndex((pane) => pane.id === id) ?? -1;
  const victim = paneAt({ lanes, at: { column, row } });
  if (victim === null) {
    return null;
  }
  const host = neighborsOf({ lanes, at: { column, row } })
    .flatMap((at) => paneAt({ lanes, at }) ?? [])
    .reduce<LanePane | null>(
      (best, pane) =>
        best === null ||
        keepRankOf({ lanes, order, pane }) > keepRankOf({ lanes, order, pane: best })
          ? pane
          : best,
      null,
    );
  if (host === null) {
    return null;
  }
  const merged = mergedPaneOf({ host, victim });
  return lanes
    .map((lane) => {
      const panes = lane.panes.flatMap((pane) => {
        if (pane === victim) {
          return [];
        }
        return pane === host ? [merged] : [pane];
      });
      const isChanged = panes.length !== lane.panes.length || panes.includes(merged);
      return isChanged ? laneOf({ panes, split: lane.split }) : lane;
    })
    .filter((lane): lane is Lane => lane !== null);
};

export const foldStatesOf = ({ lanes, order }: OrderParams): ReadonlyArray<ReadonlyArray<Lane>> =>
  order.reduce<ReadonlyArray<ReadonlyArray<Lane>>>(
    (states, id) => {
      const last = states[states.length - 1] ?? lanes;
      const next = foldedIntoNeighborOf({ lanes: last, order, id });
      return next === null ? states : [...states, next];
    },
    [lanes],
  );
