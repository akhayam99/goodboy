import { gridAfterOpen } from '../gridAfterOpen';
import { gridWithout } from '../gridWithout';
import { toolsByUseOf } from '../toolsByUseOf';
import type { DrawerGrid } from '../state';

type Params = {
  readonly live: DrawerGrid;
  readonly saved: DrawerGrid;
};

export const layoutOntoGrid = ({ live, saved }: Params): DrawerGrid => {
  const open = live.columns.flat();
  if (open.length === 0) {
    return live;
  }
  const openKinds = new Set(open.map((panel) => panel.kind));
  const base = gridWithout({
    grid: saved,
    kinds: saved.columns
      .flat()
      .map((panel) => panel.kind)
      .filter((kind) => !openKinds.has(kind)),
  });
  const placed = new Set(base.columns.flat().map((panel) => panel.kind));
  const shaped: DrawerGrid = {
    ...base,
    columns: base.columns.map((column) =>
      column.map((panel) => open.find((entry) => entry.kind === panel.kind) ?? panel),
    ),
    focus: live.focus,
  };
  const grid = toolsByUseOf({ grid: live })
    .filter((panel) => !placed.has(panel.kind))
    .reduce((current, entry) => gridAfterOpen({ grid: current, entry }), shaped);
  return { ...grid, focus: live.focus };
};
