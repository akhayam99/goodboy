import { DOCK_GRID_CAP } from './dockGridCap';
import type { Lane, LanePane } from './dockLaneTypes';
import { SIZING_RANK } from './dockSizingRank';

const DOCK_MAX_ROWS = DOCK_GRID_CAP.rows;
const EVEN_ROW_SHARE = 0.5;
const BROWSER_ROW_SHARE = 0.58;

type LeadParams = {
  readonly panes: ReadonlyArray<LanePane>;
};

const leadPaneOf = ({ panes }: LeadParams): LanePane | null =>
  panes.reduce<LanePane | null>(
    (best, pane) =>
      best === null || SIZING_RANK[pane.sizing] > SIZING_RANK[best.sizing] ? pane : best,
    null,
  );

type LaneParams = {
  readonly panes: ReadonlyArray<LanePane>;
  readonly savedWidth?: number;
  readonly split?: number;
};

export const laneOf = ({ panes, savedWidth, split }: LaneParams): Lane | null => {
  const rows = panes.slice(0, DOCK_MAX_ROWS);
  const lead = leadPaneOf({ panes: rows });
  if (lead === null) {
    return null;
  }
  const first = rows[0];
  return {
    panes: rows,
    sizing: lead.sizing,
    savedWidth: savedWidth ?? lead.savedWidth,
    split: split ?? (first?.sizing === 'browser' ? BROWSER_ROW_SHARE : EVEN_ROW_SHARE),
  };
};
