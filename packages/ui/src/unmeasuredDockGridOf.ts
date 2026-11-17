import { DRAWER_TIERS, type PanelPairLayout } from './drawerGeometry';
import type { DockGridFrame } from './dockGridFrameOf';
import { dockGridSpanOf } from './dockGridSpanOf';
import type { DockGridCell } from './dockGridSpec';

type CellParams = {
  readonly cell: DockGridCell;
};

type UnmeasuredParams = {
  readonly columns: ReadonlyArray<ReadonlyArray<DockGridCell>>;
  readonly savedWidthOf: (params: CellParams) => number;
  readonly detail: PanelPairLayout['detail'];
};

export const unmeasuredDockGridOf = ({
  columns,
  savedWidthOf,
  detail,
}: UnmeasuredParams): DockGridFrame => {
  const boxes = columns.map((column) => {
    const width = Math.max(0, ...column.map((cell) => savedWidthOf({ cell })));
    const lead = column.find((cell) => savedWidthOf({ cell }) === width);
    return {
      width,
      dragMax: lead === undefined ? width : DRAWER_TIERS[lead.sizing].max,
      panes: column.map((cell) => ({ key: cell.key, weight: 1 })),
    };
  });
  return {
    pair: {
      mode: 'push',
      dock: { width: dockGridSpanOf({ columns: boxes }), dragMax: boxes[0]?.dragMax ?? 0 },
      detail,
    },
    columns: boxes,
  };
};
