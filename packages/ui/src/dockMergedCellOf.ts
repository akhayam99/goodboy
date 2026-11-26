import { DRAWER_TIERS } from './drawerGeometry';
import { dockLeadSizingOf } from './dockLeadSizingOf';
import type { DockGridCell } from './dockGridSpec';

type Params = {
  readonly cell: DockGridCell;
};

export const dockMergedCellOf = ({ cell }: Params): DockGridCell => {
  if (cell.tabs === undefined) {
    return cell;
  }
  const members = [cell, ...cell.tabs.members];
  const sizing = dockLeadSizingOf({ sizings: members.map((member) => member.sizing) });
  const lead = members.find((member) => member.sizing === sizing) ?? cell;
  return {
    ...cell,
    sizing,
    savedWidth: lead.savedWidth ?? DRAWER_TIERS[sizing].fallback,
    rowMin: Math.max(...members.map((member) => member.rowMin ?? 0)),
    hasActivity: members.some((member) => member.hasActivity === true),
  };
};
